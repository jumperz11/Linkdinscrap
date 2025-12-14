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
 * Scrape profile data from current page with detailed logging
 */
export async function scrapeProfile(page: Page): Promise<ProfileData> {
    const url = page.url();
    const linkedin_id = extractProfileId(url);

    logAction(`📄 Scraping profile: ${linkedin_id}`);

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500); // Extra wait for dynamic content

    // Try to get name using multiple approaches
    let name = 'Unknown';

    // Method 1: Direct h1 with specific class
    try {
        name = await page.locator('h1').first().textContent() || 'Unknown';
        name = name.trim();
        if (name && name.length > 0 && name.length < 100) {
            logAction(`  ✓ Found name: ${name}`);
        } else {
            name = 'Unknown';
        }
    } catch (e) {
        logAction(`  ⚠ Name extraction failed, trying fallback...`);
    }

    // Method 2: If still unknown, try page title
    if (name === 'Unknown' || name === '') {
        try {
            const title = await page.title();
            // LinkedIn titles are like "Name | LinkedIn"
            const titleMatch = title.match(/^([^|]+)/);
            if (titleMatch && titleMatch[1].trim().length > 0) {
                name = titleMatch[1].trim();
                logAction(`  ✓ Found name from title: ${name}`);
            }
        } catch (e) { }
    }

    // Get headline
    let headline = '';
    try {
        const headlineEl = await page.locator('.text-body-medium.break-words').first();
        headline = await headlineEl.textContent() || '';
        headline = headline.trim();
    } catch (e) { }

    // Get location
    let location = '';
    try {
        const locationEl = await page.locator('.text-body-small.inline.t-black--light.break-words').first();
        location = await locationEl.textContent() || '';
        location = location.trim();
    } catch (e) { }

    // Get profile picture
    let profilePicture = '';
    try {
        // Try main profile photo
        const imgEl = await page.locator('img.pv-top-card-profile-picture__image, img.profile-photo-edit__preview, .pv-top-card__photo img').first();
        profilePicture = await imgEl.getAttribute('src') || '';

        // Fallback to any large profile image
        if (!profilePicture) {
            const fallbackImg = await page.locator('img[class*="profile"]').first();
            profilePicture = await fallbackImg.getAttribute('src') || '';
        }
    } catch (e) { }

    // Extract company from headline
    let company = '';
    if (headline.includes(' at ')) {
        company = headline.split(' at ').pop()?.trim() || '';
    } else if (headline.includes(' @ ')) {
        company = headline.split(' @ ').pop()?.trim() || '';
    }

    logAction(`  ✓ ${name} | ${headline.substring(0, 40)}...`);

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
