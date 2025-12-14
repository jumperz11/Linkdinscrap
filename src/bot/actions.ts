import { Page } from 'playwright';
import { humanDelay, humanType, humanScroll } from './delays';
import { scrapeProfile, ProfileData } from './scraper';

/**
 * View a profile (just visiting creates visibility)
 */
export async function viewProfile(page: Page, profileUrl: string): Promise<ProfileData> {
    console.log(`Visiting: ${profileUrl}`);

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(1000, 2000); // Reduced from 2-4s

    // Quick scroll to look natural
    await humanScroll(page, 'down');

    // Scrape profile data
    const profileData = await scrapeProfile(page);

    return profileData;
}

/**
 * Send a connection request with optional message
 */
export async function sendConnectionRequest(page: Page, message?: string): Promise<boolean> {
    try {
        // Look for the Connect button
        const connectButton = await page.$('button:has-text("Connect"):not([disabled])');

        if (!connectButton) {
            // Try the "More" dropdown for Connect option
            const moreButton = await page.$('button:has-text("More")');
            if (moreButton) {
                await moreButton.click();
                await humanDelay(500, 1000);

                const connectOption = await page.$('[role="menuitem"]:has-text("Connect")');
                if (connectOption) {
                    await connectOption.click();
                } else {
                    console.log('Connect option not found in dropdown');
                    return false;
                }
            } else {
                console.log('Connect button not found');
                return false;
            }
        } else {
            await connectButton.click();
        }

        await humanDelay(1000, 2000);

        // Check if there's a modal for adding a note
        if (message) {
            const addNoteButton = await page.$('button:has-text("Add a note")');
            if (addNoteButton) {
                await addNoteButton.click();
                await humanDelay(500, 1000);

                // Find the message textarea
                const textarea = await page.$('textarea[name="message"]');
                if (textarea) {
                    await textarea.fill(''); // Clear any existing text
                    await humanType(page, 'textarea[name="message"]', message);
                    await humanDelay(500, 1000);
                }
            }
        }

        // Click Send
        const sendButton = await page.$('button:has-text("Send")');
        if (sendButton) {
            await sendButton.click();
            await humanDelay(1000, 2000);
            console.log('✓ Connection request sent');
            return true;
        }

        // Sometimes it's just "Connect" confirmation
        const confirmButton = await page.$('button[aria-label*="Send now"]');
        if (confirmButton) {
            await confirmButton.click();
            await humanDelay(1000, 2000);
            console.log('✓ Connection request sent');
            return true;
        }

        return true; // Assume success if we got this far
    } catch (error) {
        console.error('Failed to send connection request:', error);
        return false;
    }
}

/**
 * Follow a profile
 */
export async function followProfile(page: Page): Promise<boolean> {
    try {
        const followButton = await page.$('button:has-text("Follow"):not(:has-text("Following"))');

        if (!followButton) {
            // Already following or button not found
            return false;
        }

        await followButton.click();
        await humanDelay(500, 1000);

        console.log('✓ Profile followed');
        return true;
    } catch (error) {
        console.error('Failed to follow profile:', error);
        return false;
    }
}

/**
 * Search LinkedIn with keywords and smart filtering
 */
export async function searchPeople(page: Page, keywords: string): Promise<string[]> {
    console.log(`Searching for: ${keywords}`);

    // Navigate to search
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await humanDelay(1500, 2500);

    // Extract profile URLs from search results with smart filtering
    const profileData: Array<{ url: string; relevance: number }> = [];
    const keywordList = keywords.toLowerCase().split(/\s+/);

    // Scroll to load more results
    for (let i = 0; i < 3; i++) {
        await humanScroll(page, 'down');
        await humanDelay(800, 1500);
    }

    // Get profile cards with name and headline for smart filtering
    const cards = await page.$$('.entity-result');

    for (const card of cards) {
        try {
            const linkEl = await card.$('a[href*="/in/"]');
            const nameEl = await card.$('.entity-result__title-text a span[aria-hidden="true"]');
            const headlineEl = await card.$('.entity-result__primary-subtitle');

            if (!linkEl) continue;

            const href = await linkEl.getAttribute('href');
            if (!href || !href.includes('/in/')) continue;

            const name = nameEl ? await nameEl.textContent() : '';
            const headline = headlineEl ? await headlineEl.textContent() : '';
            const combined = `${name} ${headline}`.toLowerCase();

            // Calculate relevance score based on keyword matches
            let relevance = 0;
            for (const kw of keywordList) {
                if (combined.includes(kw)) {
                    relevance += 10;
                }
            }

            // Bonus for exact phrase match
            if (combined.includes(keywords.toLowerCase())) {
                relevance += 20;
            }

            // Skip very low relevance (probably not related)
            if (relevance === 0 && keywordList.length > 1) {
                continue; // Skip if no keywords match
            }

            const cleanUrl = href.split('?')[0];
            const fullUrl = cleanUrl.startsWith('http')
                ? cleanUrl
                : `https://www.linkedin.com${cleanUrl}`;

            // Avoid duplicates
            if (!profileData.find(p => p.url === fullUrl)) {
                profileData.push({ url: fullUrl, relevance });
            }
        } catch (e) {
            continue;
        }
    }

    // Sort by relevance (highest first) and extract URLs
    profileData.sort((a, b) => b.relevance - a.relevance);
    const profileUrls = profileData.map(p => p.url);

    console.log(`Found ${profileUrls.length} relevant profiles`);
    return profileUrls;
}

/**
 * Go to next page of search results
 */
export async function nextSearchPage(page: Page): Promise<boolean> {
    try {
        const nextButton = await page.$('button[aria-label="Next"]');
        if (!nextButton) {
            return false;
        }

        const isDisabled = await nextButton.getAttribute('disabled');
        if (isDisabled !== null) {
            return false;
        }

        await nextButton.click();
        await humanDelay(2000, 4000);

        return true;
    } catch (error) {
        return false;
    }
}

export default {
    viewProfile,
    sendConnectionRequest,
    followProfile,
    searchPeople,
    nextSearchPage
};
