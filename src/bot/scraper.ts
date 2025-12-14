import { Page } from 'playwright';
import { getPage } from './auth';

export interface ProfileData {
    linkedin_id: string;
    linkedin_url: string;
    name: string;
    headline?: string;
    company?: string;
    location?: string;
    about?: string;
    profilePicture?: string;
    connection_count?: number;
    mutual_connections?: number;
    experience?: Array<{
        title: string;
        company: string;
        duration?: string;
    }>;
    skills?: string[];
    raw?: any;
}

// Console log buffer for UI
let consoleBuffer: string[] = [];
const MAX_CONSOLE_LINES = 100;

export function logAction(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}`;
    console.log(logLine);
    consoleBuffer.push(logLine);
    if (consoleBuffer.length > MAX_CONSOLE_LINES) {
        consoleBuffer.shift();
    }
}

export function getConsoleBuffer(): string[] {
    return [...consoleBuffer];
}

export function clearConsoleBuffer(): void {
    consoleBuffer = [];
}

/**
 * Extract profile ID from URL
 */
export function extractProfileId(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : '';
}

/**
 * Scrape profile data - SPEED MODE with short timeouts
 */
export async function scrapeProfile(page: Page): Promise<ProfileData> {
    const url = page.url();
    const linkedin_id = extractProfileId(url);

    // Get name from page title first (fastest)
    let name = 'Unknown';
    try {
        const title = await page.title();
        const titleMatch = title.match(/^([^|]+)/);
        if (titleMatch && titleMatch[1].trim().length > 0) {
            name = titleMatch[1].trim();
        }
    } catch (e) { }

    // Quick headline (2s timeout)
    let headline = '';
    try {
        headline = await page.locator('.text-body-medium.break-words').first().textContent({ timeout: 2000 }) || '';
        headline = headline.trim();
    } catch (e) { }

    // Quick location (1s timeout)
    let location = '';
    try {
        location = await page.locator('.text-body-small.inline.t-black--light.break-words').first().textContent({ timeout: 1000 }) || '';
        location = location.trim();
    } catch (e) { }

    // Quick profile picture (1s timeout)
    let profilePicture = '';
    try {
        profilePicture = await page.locator('img.pv-top-card-profile-picture__image').first().getAttribute('src', { timeout: 1000 }) || '';
    } catch (e) { }

    // Extract company from headline
    let company = '';
    if (headline.includes(' at ')) {
        company = headline.split(' at ').pop()?.trim() || '';
    } else if (headline.includes(' @ ')) {
        company = headline.split(' @ ').pop()?.trim() || '';
    }

    logAction(`  ✓ ${name}`);

    return {
        linkedin_id,
        linkedin_url: url,
        name,
        headline,
        company,
        location,
        profilePicture,
        connection_count: 0,
        mutual_connections: 0,
        experience: []
    };
}

/**
 * Scroll page to load dynamic content with human-like behavior
 */
export async function scrollToLoadContent(page: Page): Promise<void> {
    logAction(`  📜 Scrolling page naturally...`);

    // Random scroll pattern
    const scrollCount = Math.floor(Math.random() * 3) + 2; // 2-4 scrolls

    for (let i = 0; i < scrollCount; i++) {
        const scrollAmount = Math.floor(Math.random() * 300) + 200; // 200-500px
        await page.evaluate((amount) => {
            window.scrollBy({ top: amount, behavior: 'smooth' });
        }, scrollAmount);

        // Random pause between scrolls
        await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
    }
}

export default {
    scrapeProfile,
    extractProfileId,
    scrollToLoadContent,
    logAction,
    getConsoleBuffer,
    clearConsoleBuffer
};
