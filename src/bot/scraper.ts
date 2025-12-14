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

/**
 * Extract profile ID from URL
 */
export function extractProfileId(url: string): string {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
    return match ? match[1] : '';
}

/**
 * Scrape profile data from current page
 */
export async function scrapeProfile(page: Page): Promise<ProfileData> {
    const url = page.url();
    const linkedin_id = extractProfileId(url);

    // Wait for main content to load
    await page.waitForSelector('h1', { timeout: 10000 }).catch(() => { });

    // Try multiple selectors for name (LinkedIn changes these often)
    let name = 'Unknown';
    const nameSelectors = [
        'h1.text-heading-xlarge',
        'h1.inline.t-24.v-align-middle.break-words',
        '.pv-text-details__left-panel h1',
        'h1[class*="text-heading"]',
        '.artdeco-entity-lockup__title',
        'h1'
    ];

    for (const selector of nameSelectors) {
        try {
            const text = await page.$eval(selector, el => el.textContent?.trim() || '');
            if (text && text.length > 0 && text !== 'Unknown') {
                name = text;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    // Try multiple selectors for headline
    let headline = '';
    const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '[data-generated-suggestion-target]',
        '.artdeco-entity-lockup__subtitle'
    ];

    for (const selector of headlineSelectors) {
        try {
            const text = await page.$eval(selector, el => el.textContent?.trim() || '');
            if (text && text.length > 0) {
                headline = text;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    // Try multiple selectors for location
    let location = '';
    const locationSelectors = [
        '.pv-text-details__left-panel .text-body-small',
        '.pv-text-details__left-panel span.text-body-small',
        '[class*="top-card"] .text-body-small'
    ];

    for (const selector of locationSelectors) {
        try {
            const text = await page.$eval(selector, el => el.textContent?.trim() || '');
            if (text && text.length > 0) {
                location = text;
                break;
            }
        } catch (e) {
            continue;
        }
    }

    // Extract company from headline or experience
    let company = '';
    const headlineParts = headline.split(' at ');
    if (headlineParts.length > 1) {
        company = headlineParts[headlineParts.length - 1].trim();
    }

    // Try to get company from experience section if not in headline
    if (!company) {
        company = await page.$eval(
            '.pv-text-details__right-panel .inline-show-more-text',
            el => el.textContent?.trim() || ''
        ).catch(() => '');
    }

    // Extract about section
    const about = await page.$eval(
        '#about ~ .display-flex .inline-show-more-text, .pv-about-section .pv-about__summary-text',
        el => el.textContent?.trim() || ''
    ).catch(() => '');

    // Extract connection count
    let connection_count = 0;
    const connectionText = await page.$eval(
        '.pv-top-card--list-bullet li:first-child span',
        el => el.textContent || ''
    ).catch(() => '');

    const connMatch = connectionText.match(/(\d+)/);
    if (connMatch) {
        connection_count = parseInt(connMatch[1], 10);
    }

    // Extract mutual connections
    let mutual_connections = 0;
    const mutualText = await page.$eval(
        '.pv-top-card--list-bullet .t-black--light',
        el => el.textContent || ''
    ).catch(() => '');

    const mutualMatch = mutualText.match(/(\d+)\s*mutual/i);
    if (mutualMatch) {
        mutual_connections = parseInt(mutualMatch[1], 10);
    }

    // Extract experience (first 3 entries)
    const experience: ProfileData['experience'] = [];
    const expItems = await page.$$('[data-view-name="profile-component-entity"]');

    for (const item of expItems.slice(0, 3)) {
        try {
            const title = await item.$eval(
                '.t-bold span[aria-hidden="true"]',
                el => el.textContent?.trim() || ''
            ).catch(() => '');

            const expCompany = await item.$eval(
                '.t-normal span[aria-hidden="true"]',
                el => el.textContent?.trim() || ''
            ).catch(() => '');

            const duration = await item.$eval(
                '.t-black--light span[aria-hidden="true"]',
                el => el.textContent?.trim() || ''
            ).catch(() => '');

            if (title || expCompany) {
                experience.push({ title, company: expCompany, duration });
            }
        } catch (e) {
            continue;
        }
    }

    return {
        linkedin_id,
        linkedin_url: url,
        name,
        headline,
        company,
        location,
        about,
        connection_count,
        mutual_connections,
        experience
    };
}

/**
 * Scroll page to load dynamic content
 */
export async function scrollToLoadContent(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight / 2) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

export default {
    scrapeProfile,
    extractProfileId,
    scrollToLoadContent
};
