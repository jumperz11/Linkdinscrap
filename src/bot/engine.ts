import { Page } from 'playwright';
import { getPage, checkLinkedInLogin } from './auth';
import { scrapeProfile, ProfileData } from './scraper';
import { viewProfile, sendConnectionRequest, followProfile, searchPeople, nextSearchPage } from './actions';
import { humanDelay, randomDelay } from './delays';
import { sessionQueries, profileQueries, configQueries } from '../db/sqlite';
import { updateSessionState, getCurrentSession } from '../api/routes';
import { scoreProfile as aiScoreProfile } from '../ai/scorer';
import { generateConnectionMessage } from '../ai/messages';
import { getSavedUserProfile } from '../ai/analyzer';

export interface SessionConfig {
    keywords: string;
    threshold: number;
    maxProfiles: number;
    maxDuration: number; // minutes
    minDelay: number;
    maxDelay: number;
    enableConnect: boolean;
    enableFollow: boolean;
}

export interface SessionStats {
    profilesViewed: number;
    connectionsSent: number;
    followsSent: number;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'stopped' | 'error';
}

// Active session state
let activeSession: {
    config: SessionConfig;
    stats: SessionStats;
    sessionId: number;
    running: boolean;
    profileUrls: string[];
    currentPageIndex: number;
} | null = null;

// Use AI for scoring (with fallback)
async function scoreProfile(profile: ProfileData, keywords: string): Promise<{ score: number; reason: string; category: string }> {
    const userProfile = getSavedUserProfile();
    const result = await aiScoreProfile(profile, userProfile, keywords);
    return result;
}

// Use AI for message generation (with fallback)
async function generateMessage(profile: ProfileData): Promise<string> {
    const userProfile = getSavedUserProfile();
    const message = await generateConnectionMessage(profile, userProfile);
    return message;
}

/**
 * Start a bot session
 */
export async function startSession(config: SessionConfig): Promise<number> {
    // Check if already running
    if (activeSession?.running) {
        throw new Error('Session already running');
    }

    // Verify login
    const page = getPage();
    if (!page) {
        throw new Error('Browser not initialized. Please login first.');
    }

    const isLoggedIn = await checkLinkedInLogin();
    if (!isLoggedIn) {
        throw new Error('Not logged into LinkedIn');
    }

    // Create session in database
    const sessionId = Number(sessionQueries.create(config.keywords, config));

    // Initialize session state
    activeSession = {
        config,
        stats: {
            profilesViewed: 0,
            connectionsSent: 0,
            followsSent: 0,
            startTime: new Date(),
            status: 'running'
        },
        sessionId,
        running: true,
        profileUrls: [],
        currentPageIndex: 0
    };

    // Update UI state
    updateSessionState({
        id: sessionId,
        running: true,
        profilesViewed: 0,
        connectionsSent: 0,
        followsSent: 0,
        currentProfile: null,
        profiles: []
    });

    // Start the session loop in background
    runSessionLoop(page).catch(error => {
        console.error('Session error:', error);
        stopSession('error');
    });

    return sessionId;
}

/**
 * Main session loop
 */
async function runSessionLoop(page: Page): Promise<void> {
    if (!activeSession) return;

    const { config, stats, sessionId } = activeSession;
    const maxDurationMs = config.maxDuration * 60 * 1000;
    const startTime = stats.startTime.getTime();

    console.log(`Session ${sessionId} started: ${config.keywords}`);

    try {
        // Search for profiles
        activeSession.profileUrls = await searchPeople(page, config.keywords);

        // Process profiles
        while (activeSession.running) {
            // Check limits
            if (stats.profilesViewed >= config.maxProfiles) {
                console.log('Profile limit reached');
                break;
            }

            if (Date.now() - startTime >= maxDurationMs) {
                console.log('Time limit reached');
                break;
            }

            // Get next profile URL
            if (activeSession.currentPageIndex >= activeSession.profileUrls.length) {
                // Try to get more profiles from next page
                const hasMore = await nextSearchPage(page);
                if (!hasMore) {
                    console.log('No more profiles to visit');
                    break;
                }

                const moreUrls = await searchPeople(page, config.keywords);
                activeSession.profileUrls = [...activeSession.profileUrls, ...moreUrls];

                if (activeSession.currentPageIndex >= activeSession.profileUrls.length) {
                    break;
                }
            }

            const profileUrl = activeSession.profileUrls[activeSession.currentPageIndex];
            activeSession.currentPageIndex++;

            // Skip if already visited
            const profileId = profileUrl.split('/in/')[1]?.split('/')[0];
            if (profileId && profileQueries.exists(profileId)) {
                console.log(`Skipping already visited: ${profileId}`);
                continue;
            }

            // Visit profile
            const profileData = await viewProfile(page, profileUrl);
            stats.profilesViewed++;

            // Score profile
            const { score, reason } = await scoreProfile(profileData, config.keywords);

            // Determine action
            let action = 'viewed';
            let messageSent = '';

            if (score >= config.threshold) {
                // High potential - connect and follow based on config

                // Only connect if enabled
                if (config.enableConnect) {
                    const message = await generateMessage(profileData);
                    const connected = await sendConnectionRequest(page, message);

                    if (connected) {
                        stats.connectionsSent++;
                        action = 'connected';
                        messageSent = message;
                    }
                }

                // Only follow if enabled
                if (config.enableFollow) {
                    const followed = await followProfile(page);
                    if (followed) {
                        stats.followsSent++;
                        action = action === 'connected' ? 'connected+followed' : 'followed';
                    }
                }
            }

            // Save to database
            profileQueries.create({
                linkedin_id: profileData.linkedin_id,
                linkedin_url: profileData.linkedin_url,
                name: profileData.name,
                headline: profileData.headline,
                company: profileData.company,
                location: profileData.location,
                score,
                score_reason: reason,
                action_taken: action,
                message_sent: messageSent,
                session_id: sessionId,
                data: profileData
            });

            // Update UI
            updateSessionState({
                profilesViewed: stats.profilesViewed,
                connectionsSent: stats.connectionsSent,
                followsSent: stats.followsSent,
                currentProfile: { ...profileData, score, action },
                profiles: profileQueries.getBySession(sessionId) as any[]
            });

            // Update database
            sessionQueries.update(sessionId, {
                profiles_viewed: stats.profilesViewed,
                connections_sent: stats.connectionsSent,
                follows_sent: stats.followsSent
            });

            console.log(`[${stats.profilesViewed}/${config.maxProfiles}] ${profileData.name} - Score: ${score} - ${action}`);

            // Human delay before next profile
            await humanDelay(config.minDelay, config.maxDelay);
        }

        // Session completed
        await stopSession('completed');

    } catch (error: any) {
        console.error('Session loop error:', error);
        await stopSession('error');
        throw error;
    }
}

/**
 * Stop the current session
 */
export async function stopSession(status: 'completed' | 'stopped' | 'error' = 'stopped'): Promise<void> {
    if (!activeSession) return;

    activeSession.running = false;
    activeSession.stats.status = status;
    activeSession.stats.endTime = new Date();

    // Update database
    sessionQueries.update(activeSession.sessionId, {
        status,
        ended_at: new Date().toISOString(),
        profiles_viewed: activeSession.stats.profilesViewed,
        connections_sent: activeSession.stats.connectionsSent,
        follows_sent: activeSession.stats.followsSent
    });

    // Update UI
    updateSessionState({
        running: false
    });

    console.log(`Session ${activeSession.sessionId} ${status}: ${activeSession.stats.profilesViewed} profiles, ${activeSession.stats.connectionsSent} connections`);

    activeSession = null;
}

/**
 * Get current session status
 */
export function getSessionStatus(): {
    running: boolean;
    stats?: SessionStats;
    config?: SessionConfig;
} {
    if (!activeSession) {
        return { running: false };
    }

    return {
        running: activeSession.running,
        stats: activeSession.stats,
        config: activeSession.config
    };
}

export default {
    startSession,
    stopSession,
    getSessionStatus
};
