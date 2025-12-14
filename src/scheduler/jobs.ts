import * as cron from 'node-cron';
import { scheduleQueries, configQueries } from '../db/sqlite';
import { startSession, getSessionStatus, stopSession } from '../bot/engine';
import { checkLinkedInLogin } from '../bot/auth';

// Active cron jobs
const activeJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();

/**
 * Initialize scheduler from saved settings
 */
export function initializeScheduler(): void {
    const schedule = scheduleQueries.get();
    if (schedule && schedule.enabled) {
        setupSchedule(schedule);
    }
    console.log('✓ Scheduler initialized');
}

/**
 * Setup schedule based on configuration
 */
export function setupSchedule(schedule: {
    enabled: boolean;
    times: string[];
    days: string[];
    search_keywords: string;
}): void {
    // Clear existing jobs
    clearAllJobs();

    if (!schedule.enabled || !schedule.times.length) {
        console.log('Scheduling disabled');
        return;
    }

    // Convert days to cron format
    const dayMap: Record<string, number> = {
        'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };

    const cronDays = schedule.days
        .map(d => dayMap[d.toLowerCase()])
        .filter(d => d !== undefined)
        .join(',');

    if (!cronDays) {
        console.log('No valid days configured');
        return;
    }

    // Create a cron job for each scheduled time
    for (const time of schedule.times) {
        const [hours, minutes] = time.split(':').map(Number);

        if (isNaN(hours) || isNaN(minutes)) {
            console.log(`Invalid time format: ${time}`);
            continue;
        }

        // Cron format: minute hour * * day
        const cronExpression = `${minutes} ${hours} * * ${cronDays}`;

        try {
            const job = cron.schedule(cronExpression, async () => {
                await runScheduledSession(schedule.search_keywords);
            });

            activeJobs.set(time, job);
            console.log(`✓ Scheduled job at ${time} on days: ${schedule.days.join(', ')}`);
        } catch (error) {
            console.error(`Failed to schedule job for ${time}:`, error);
        }
    }
}

/**
 * Run a scheduled session
 */
async function runScheduledSession(keywords: string): Promise<void> {
    console.log(`\n[SCHEDULED] Starting session at ${new Date().toLocaleString()}`);

    // Check if already running
    const status = getSessionStatus();
    if (status.running) {
        console.log('[SCHEDULED] Session already running, skipping');
        return;
    }

    // Verify LinkedIn login
    try {
        const isLoggedIn = await checkLinkedInLogin();
        if (!isLoggedIn) {
            console.log('[SCHEDULED] Not logged into LinkedIn, skipping');
            return;
        }
    } catch (error) {
        console.error('[SCHEDULED] Login check failed:', error);
        return;
    }

    // Start session with saved config
    try {
        await startSession({
            keywords,
            threshold: configQueries.get('threshold') || 75,
            maxProfiles: configQueries.get('maxProfiles') || 100,
            maxDuration: configQueries.get('maxDuration') || 60,
            minDelay: configQueries.get('minDelay') || 3000,
            maxDelay: configQueries.get('maxDelay') || 8000,
            enableConnect: configQueries.get('enableConnect') || false,
            enableFollow: configQueries.get('enableFollow') || false
        });

        console.log('[SCHEDULED] Session started successfully');
    } catch (error) {
        console.error('[SCHEDULED] Failed to start session:', error);
    }
}

/**
 * Clear all active jobs
 */
export function clearAllJobs(): void {
    for (const [time, job] of activeJobs) {
        job.stop();
        console.log(`Stopped job at ${time}`);
    }
    activeJobs.clear();
}

/**
 * Get next scheduled run time
 */
export function getNextScheduledTime(): Date | null {
    const schedule = scheduleQueries.get();
    if (!schedule || !schedule.enabled || !schedule.times.length) {
        return null;
    }

    const now = new Date();
    const dayMap: Record<string, number> = {
        'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6
    };

    const scheduledDays = schedule.days
        .map((d: string) => dayMap[d.toLowerCase()])
        .filter((d: number | undefined) => d !== undefined) as number[];

    scheduledDays.sort((a: number, b: number) => a - b);

    if (!scheduledDays.length) return null;

    // Find next occurrence
    for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + daysAhead);

        if (!scheduledDays.includes(checkDate.getDay())) continue;

        for (const time of schedule.times.sort()) {
            const [hours, minutes] = time.split(':').map(Number);
            const scheduledTime = new Date(checkDate);
            scheduledTime.setHours(hours, minutes, 0, 0);

            if (scheduledTime > now) {
                return scheduledTime;
            }
        }
    }

    return null;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
    enabled: boolean;
    activeJobs: number;
    nextRun: Date | null;
} {
    const schedule = scheduleQueries.get();
    return {
        enabled: schedule?.enabled || false,
        activeJobs: activeJobs.size,
        nextRun: getNextScheduledTime()
    };
}

export default {
    initializeScheduler,
    setupSchedule,
    clearAllJobs,
    getNextScheduledTime,
    getSchedulerStatus
};
