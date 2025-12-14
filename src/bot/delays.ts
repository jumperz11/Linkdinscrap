import { Page } from 'playwright';
import { logAction } from './scraper';

// Session behavior randomization
let sessionBehavior = {
    baseDelay: 3000,
    delayVariance: 5000,
    scrollChance: 0.7,
    mouseChance: 0.5,
    pauseChance: 0.15, // 15% chance of longer pause
    profilesBeforePause: 0,
    pauseThreshold: 0
};

/**
 * Initialize random behavior patterns for this session
 * This makes each session behave differently - FASTER version
 */
export function initSessionBehavior(): void {
    sessionBehavior = {
        baseDelay: Math.floor(Math.random() * 1000) + 1500, // 1.5-2.5 seconds base (faster)
        delayVariance: Math.floor(Math.random() * 1500) + 1000, // 1-2.5 seconds variance (faster)
        scrollChance: Math.random() * 0.3 + 0.4, // 40-70% scroll chance
        mouseChance: Math.random() * 0.3 + 0.2, // 20-50% mouse move chance
        pauseChance: Math.random() * 0.05 + 0.05, // 5-10% pause chance (less pauses)
        profilesBeforePause: Math.floor(Math.random() * 8) + 8, // Pause every 8-16 profiles (less frequent)
        pauseThreshold: 0
    };

    logAction(`🎭 Session behavior (fast mode):`);
    logAction(`   Base delay: ${sessionBehavior.baseDelay}ms`);
    logAction(`   Pause every ~${sessionBehavior.profilesBeforePause} profiles`);
}

/**
 * Human-like delay with high variance
 */
export function randomDelay(min?: number, max?: number): number {
    const minDelay = min ?? sessionBehavior.baseDelay;
    const maxDelay = max ?? (sessionBehavior.baseDelay + sessionBehavior.delayVariance);

    // Add extra randomness - sometimes much shorter, sometimes much longer
    const extraRandom = Math.random();
    if (extraRandom < 0.1) {
        // 10% chance of quick action (but not too quick)
        return Math.floor(Math.random() * 1000) + 2000;
    } else if (extraRandom > 0.95) {
        // 5% chance of very long pause (thinking)
        return Math.floor(Math.random() * 5000) + 8000;
    }

    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

/**
 * Sleep for a random amount of time with logging
 */
export async function humanDelay(min?: number, max?: number, action?: string): Promise<void> {
    const delay = randomDelay(min, max);
    if (action) {
        logAction(`  ⏳ ${action} (${(delay / 1000).toFixed(1)}s)`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Type text with human-like delays between keystrokes
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
    logAction(`  ⌨️ Typing: "${text.substring(0, 20)}..."`);
    await page.click(selector);

    for (const char of text) {
        await page.keyboard.type(char);
        // Variable typing speed
        const charDelay = Math.floor(Math.random() * 150) + 50; // 50-200ms per char
        await new Promise(resolve => setTimeout(resolve, charDelay));

        // Occasional longer pause (like thinking)
        if (Math.random() < 0.05) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
        }
    }
}

/**
 * Scroll like a human (variable speed, pauses, sometimes back up)
 */
export async function humanScroll(page: Page, direction: 'down' | 'up' = 'down'): Promise<void> {
    if (Math.random() > sessionBehavior.scrollChance) {
        return; // Skip scrolling sometimes
    }

    const scrollTimes = Math.floor(Math.random() * 3) + 1; // 1-3 scroll actions

    for (let i = 0; i < scrollTimes; i++) {
        const distance = direction === 'down'
            ? Math.floor(Math.random() * 400) + 100  // 100-500px down
            : -Math.floor(Math.random() * 200) - 50; // 50-250px up

        await page.evaluate((d) => {
            window.scrollBy({ top: d, behavior: 'smooth' });
        }, distance);

        // Random pause while scrolling
        await new Promise(resolve => setTimeout(resolve, randomDelay(300, 1200)));

        // Sometimes scroll back a bit (reading behavior)
        if (Math.random() < 0.2 && direction === 'down') {
            const backDistance = -Math.floor(Math.random() * 100) - 30;
            await page.evaluate((d) => {
                window.scrollBy({ top: d, behavior: 'smooth' });
            }, backDistance);
            await new Promise(resolve => setTimeout(resolve, randomDelay(200, 800)));
        }
    }
}

/**
 * Move mouse randomly to simulate human presence
 */
export async function humanMouseMove(page: Page): Promise<void> {
    if (Math.random() > sessionBehavior.mouseChance) {
        return; // Skip mouse movement sometimes
    }

    const viewportSize = await page.viewportSize();
    if (!viewportSize) return;

    // Move to a random position
    const x = Math.floor(Math.random() * (viewportSize.width * 0.8)) + (viewportSize.width * 0.1);
    const y = Math.floor(Math.random() * (viewportSize.height * 0.6)) + (viewportSize.height * 0.2);

    // Random number of steps (more = slower movement)
    const steps = Math.floor(Math.random() * 15) + 5;

    await page.mouse.move(x, y, { steps });
}

/**
 * Wait for navigation with random extra delay
 */
export async function humanWaitForNavigation(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded');
    await humanDelay(1000, 3000);
}

/**
 * Simulate reading content - varies by "content length"
 */
export async function simulateReading(page: Page, contentType: 'profile' | 'search' | 'message' = 'profile'): Promise<void> {
    const readTimes = {
        profile: [3000, 8000],
        search: [1500, 4000],
        message: [2000, 5000]
    };

    const [min, max] = readTimes[contentType];

    // Simulate reading with scrolling and mouse movement
    await humanScroll(page);
    await humanDelay(min, max, `Reading ${contentType}`);

    // Sometimes move mouse while reading
    if (Math.random() < 0.4) {
        await humanMouseMove(page);
    }

    // Random chance of scrolling more
    if (Math.random() < 0.3) {
        await humanScroll(page);
        await humanDelay(1000, 3000);
    }
}

/**
 * Take a longer break (like getting distracted)
 */
export async function takeMicroBreak(): Promise<void> {
    sessionBehavior.pauseThreshold++;

    if (sessionBehavior.pauseThreshold >= sessionBehavior.profilesBeforePause) {
        const breakDuration = Math.floor(Math.random() * 20000) + 10000; // 10-30 seconds
        logAction(`☕ Taking a micro-break (${(breakDuration / 1000).toFixed(0)}s)...`);
        await new Promise(resolve => setTimeout(resolve, breakDuration));

        // Reset counter with new random threshold
        sessionBehavior.pauseThreshold = 0;
        sessionBehavior.profilesBeforePause = Math.floor(Math.random() * 5) + 3;
    }
}

export default {
    initSessionBehavior,
    randomDelay,
    humanDelay,
    humanType,
    humanScroll,
    humanMouseMove,
    humanWaitForNavigation,
    simulateReading,
    takeMicroBreak
};
