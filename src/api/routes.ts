import { Router, Request, Response } from 'express';
import auth from '../bot/auth';
import { initializeDatabase, configQueries, sessionQueries, profileQueries, scheduleQueries, userProfileQueries } from '../db/sqlite';

const router = Router();

// Initialize database on module load
initializeDatabase();

// ============================================
// Health Check
// ============================================
router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Authentication Routes
// ============================================

// Get auth status
router.get('/auth/status', async (req: Request, res: Response) => {
    try {
        const status = auth.getAuthStatus();

        // If not connected and not in login progress, try to check
        if (!status.connected && !status.loginInProgress) {
            const connected = await auth.checkLinkedInLogin();
            res.json({ connected, loginInProgress: false });
        } else {
            res.json(status);
        }
    } catch (error: any) {
        res.json({ connected: false, error: error.message });
    }
});

// Start login flow
router.post('/auth/login', async (req: Request, res: Response) => {
    try {
        // Start login in background (don't await)
        auth.startLogin().catch(err => {
            console.error('Login error:', err.message);
        });

        res.json({ success: true, message: 'Login window opened' });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout (close browser)
router.post('/auth/logout', async (req: Request, res: Response) => {
    try {
        await auth.closeBrowser();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Configuration Routes
// ============================================

// Get config
router.get('/config', (req: Request, res: Response) => {
    try {
        const config = {
            keywords: configQueries.get('keywords') || '',
            threshold: configQueries.get('threshold') || 75,
            maxProfiles: configQueries.get('maxProfiles') || 100,
            maxDuration: configQueries.get('maxDuration') || 60,
            minDelay: configQueries.get('minDelay') || 3000,
            maxDelay: configQueries.get('maxDelay') || 8000
        };
        res.json(config);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update config
router.put('/config', (req: Request, res: Response) => {
    try {
        const { keywords, threshold, maxProfiles, maxDuration, minDelay, maxDelay } = req.body;

        if (keywords !== undefined) configQueries.set('keywords', keywords);
        if (threshold !== undefined) configQueries.set('threshold', threshold);
        if (maxProfiles !== undefined) configQueries.set('maxProfiles', maxProfiles);
        if (maxDuration !== undefined) configQueries.set('maxDuration', maxDuration);
        if (minDelay !== undefined) configQueries.set('minDelay', minDelay);
        if (maxDelay !== undefined) configQueries.set('maxDelay', maxDelay);

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Session Routes (placeholders for now)
// ============================================

// Current session state
let currentSession: {
    id: number | null;
    running: boolean;
    profilesViewed: number;
    connectionsSent: number;
    followsSent: number;
    currentProfile: any;
    profiles: any[];
} = {
    id: null,
    running: false,
    profilesViewed: 0,
    connectionsSent: 0,
    followsSent: 0,
    currentProfile: null,
    profiles: []
};

// Get session status
router.get('/session/status', (req: Request, res: Response) => {
    res.json({
        running: currentSession.running,
        sessionId: currentSession.id,
        profilesViewed: currentSession.profilesViewed,
        connectionsSent: currentSession.connectionsSent,
        followsSent: currentSession.followsSent,
        currentProfile: currentSession.currentProfile,
        profiles: currentSession.profiles,
        completed: !currentSession.running && currentSession.id !== null
    });
});

// Start session (placeholder)
router.post('/session/start', async (req: Request, res: Response) => {
    try {
        const { keywords, threshold } = req.body;

        if (!keywords) {
            return res.status(400).json({ error: 'Keywords required' });
        }

        // Save config
        configQueries.set('keywords', keywords);
        configQueries.set('threshold', threshold || 75);

        // Import engine dynamically to avoid circular deps
        const { startSession } = await import('../bot/engine');

        // Start the session
        const sessionId = await startSession({
            keywords,
            threshold: threshold || 75,
            maxProfiles: configQueries.get('maxProfiles') || 100,
            maxDuration: configQueries.get('maxDuration') || 60,
            minDelay: configQueries.get('minDelay') || 3000,
            maxDelay: configQueries.get('maxDelay') || 8000
        });

        res.json({ success: true, sessionId });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Stop session
router.post('/session/stop', async (req: Request, res: Response) => {
    try {
        // Import engine dynamically
        const { stopSession } = await import('../bot/engine');
        await stopSession('stopped');

        currentSession.running = false;

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Profile Routes
// ============================================

// Get profiles from latest session
router.get('/profiles', (req: Request, res: Response) => {
    try {
        const sessionId = req.query.sessionId as string;
        const category = req.query.category as string;

        let profiles;
        if (sessionId) {
            profiles = profileQueries.getBySession(parseInt(sessionId));
        } else if (category) {
            profiles = profileQueries.getByCategory(category);
        } else {
            profiles = currentSession.profiles;
        }

        res.json(profiles);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Schedule Routes
// ============================================

// Get schedule
router.get('/schedule', (req: Request, res: Response) => {
    try {
        const schedule = scheduleQueries.get();
        res.json(schedule || { enabled: false, times: [], days: [], search_keywords: '' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update schedule
router.put('/schedule', async (req: Request, res: Response) => {
    try {
        const { enabled, times, days, search_keywords } = req.body;
        scheduleQueries.save({ enabled, times, days, search_keywords });

        // Reinitialize scheduler with new settings
        const { setupSchedule } = await import('../scheduler/jobs');
        setupSchedule({ enabled, times, days, search_keywords });

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// User Profile Routes
// ============================================

// Get user's own profile analysis
router.get('/user-profile', (req: Request, res: Response) => {
    try {
        const profile = userProfileQueries.get();
        res.json(profile || null);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Analyze user's own profile (scrape and save)
router.post('/user-profile/analyze', async (req: Request, res: Response) => {
    try {
        const { analyzeUserProfile } = await import('../ai/analyzer');
        const profile = await analyzeUserProfile();
        res.json({ success: true, profile });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent sessions
router.get('/sessions', (req: Request, res: Response) => {
    try {
        const sessions = sessionQueries.getRecent(10);
        res.json(sessions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Export for session updates
export function updateSessionState(update: Partial<typeof currentSession>) {
    Object.assign(currentSession, update);
}

export function getCurrentSession() {
    return currentSession;
}

export default router;
