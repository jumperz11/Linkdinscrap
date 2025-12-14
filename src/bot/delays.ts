import { Page } from 'playwright';

/**
 * Human-like delay with randomization
 */
export function randomDelay(min: number = 3000, max: number = 8000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random amount of time
 */
export async function humanDelay(min: number = 3000, max: number = 8000): Promise<void> {
    const delay = randomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Type text with human-like delays between keystrokes
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
    await page.click(selector);

    for (const char of text) {
        await page.keyboard.type(char);
        await new Promise(resolve => setTimeout(resolve, randomDelay(50, 150)));
    }
}

/**
 * Scroll like a human (variable speed, pauses)
 */
export async function humanScroll(page: Page, direction: 'down' | 'up' = 'down'): Promise<void> {
    const distance = direction === 'down' ? randomDelay(200, 400) : -randomDelay(200, 400);

    await page.evaluate((d) => {
        window.scrollBy({ top: d, behavior: 'smooth' });
    }, distance);

    // Random pause while scrolling
    await new Promise(resolve => setTimeout(resolve, randomDelay(500, 1500)));
}

/**
 * Move mouse randomly to simulate human presence
 */
export async function humanMouseMove(page: Page): Promise<void> {
    const viewportSize = await page.viewportSize();
    if (!viewportSize) return;

    const x = Math.floor(Math.random() * viewportSize.width);
    const y = Math.floor(Math.random() * viewportSize.height);

    await page.mouse.move(x, y, { steps: randomDelay(5, 15) });
}

/**
 * Wait for navigation with random extra delay
 */
export async function humanWaitForNavigation(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded');
    await humanDelay(1000, 2000);
}

export default {
    randomDelay,
    humanDelay,
    humanType,
    humanScroll,
    humanMouseMove,
    humanWaitForNavigation
};
