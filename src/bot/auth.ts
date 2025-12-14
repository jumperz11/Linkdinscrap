import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

// Paths
const DATA_DIR = path.join(__dirname, '../../data');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');
const USER_DATA_DIR = path.join(DATA_DIR, 'browser-data');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Browser state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

export interface AuthStatus {
    connected: boolean;
    loginInProgress: boolean;
    error?: string;
}

let authStatus: AuthStatus = {
    connected: false,
    loginInProgress: false
};

/**
 * Initialize the browser with persistent context
 */
export async function initBrowser(): Promise<void> {
    if (browser) {
        console.log('Browser already initialized');
        return;
    }

    console.log('Launching browser...');

    browser = await chromium.launch({
        headless: false, // Visible browser for login
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });

    // Create context with persistent storage
    context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        storageState: fs.existsSync(COOKIES_PATH) ? COOKIES_PATH : undefined
    });

    // Add stealth scripts to avoid detection
    await context.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    });

    page = await context.newPage();
    console.log('✓ Browser initialized');
}

/**
 * Close the browser
 */
export async function closeBrowser(): Promise<void> {
    if (context) {
        // Save cookies before closing
        await saveCookies();
        await context.close();
        context = null;
    }
    if (browser) {
        await browser.close();
        browser = null;
    }
    page = null;
    console.log('✓ Browser closed');
}

/**
 * Save current cookies to file
 */
export async function saveCookies(): Promise<void> {
    if (!context) return;

    try {
        const storage = await context.storageState();
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(storage, null, 2));
        console.log('✓ Cookies saved');
    } catch (error) {
        console.error('Failed to save cookies:', error);
    }
}

/**
 * Check if user is logged into LinkedIn
 */
export async function checkLinkedInLogin(): Promise<boolean> {
    if (!page) {
        await initBrowser();
    }

    try {
        // Navigate to LinkedIn feed (requires login)
        await page!.goto('https://www.linkedin.com/feed/', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait a bit for redirects
        await page!.waitForTimeout(2000);

        const url = page!.url();

        // If we're on the feed, we're logged in
        if (url.includes('/feed')) {
            authStatus.connected = true;
            await saveCookies();
            return true;
        }

        // If we're on login page, not logged in
        authStatus.connected = false;
        return false;
    } catch (error) {
        console.error('Error checking login:', error);
        authStatus.connected = false;
        return false;
    }
}

/**
 * Start login flow - opens LinkedIn login page for manual login
 */
export async function startLogin(): Promise<void> {
    if (authStatus.loginInProgress) {
        throw new Error('Login already in progress');
    }

    authStatus.loginInProgress = true;

    try {
        await initBrowser();

        // Navigate to LinkedIn login
        await page!.goto('https://www.linkedin.com/login', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('Waiting for user to login...');

        // Wait for successful login (redirect to feed)
        // This will wait up to 5 minutes for the user to complete login
        await page!.waitForURL('**/feed/**', { timeout: 300000 });

        // Save cookies after successful login
        await saveCookies();

        authStatus.connected = true;
        authStatus.loginInProgress = false;

        console.log('✓ Login successful');
    } catch (error: any) {
        authStatus.loginInProgress = false;

        // Check if we actually got logged in despite timeout
        const url = page?.url() || '';
        if (url.includes('/feed')) {
            authStatus.connected = true;
            await saveCookies();
            console.log('✓ Login successful (late detection)');
        } else {
            authStatus.connected = false;
            authStatus.error = error.message;
            throw error;
        }
    }
}

/**
 * Get current auth status
 */
export function getAuthStatus(): AuthStatus {
    return { ...authStatus };
}

/**
 * Get the current page for automation
 */
export function getPage(): Page | null {
    return page;
}

/**
 * Get the browser context
 */
export function getContext(): BrowserContext | null {
    return context;
}

export default {
    initBrowser,
    closeBrowser,
    saveCookies,
    checkLinkedInLogin,
    startLogin,
    getAuthStatus,
    getPage,
    getContext
};
