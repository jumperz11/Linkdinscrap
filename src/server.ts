import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import apiRoutes from './api/routes';
import { initializeScheduler, clearAllJobs } from './scheduler/jobs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    clearAllJobs();
    const auth = await import('./bot/auth');
    await auth.closeBrowser();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    // Initialize scheduler
    initializeScheduler();

    console.log(`
  ╔═══════════════════════════════════════╗
  ║         LinkScope Dashboard           ║
  ║   http://localhost:${PORT}               ║
  ╚═══════════════════════════════════════╝
  `);
});

export default app;
