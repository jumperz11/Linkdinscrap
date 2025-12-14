import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Database connection
const dbPath = path.join(dataDir, 'linkscope.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
export function initializeDatabase(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('✓ Database initialized');
}

// Config operations
export const configQueries = {
    get: (key: string) => {
        const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? JSON.parse(row.value) : null;
    },

    set: (key: string, value: any) => {
        db.prepare(`
      INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, JSON.stringify(value), JSON.stringify(value));
    }
};

// Session operations
export const sessionQueries = {
    create: (keywords: string, config: any) => {
        const result = db.prepare(`
      INSERT INTO sessions (search_keywords, config) VALUES (?, ?)
    `).run(keywords, JSON.stringify(config));
        return result.lastInsertRowid;
    },

    update: (id: number, data: Partial<{
        profiles_viewed: number;
        connections_sent: number;
        follows_sent: number;
        status: string;
        ended_at: string;
    }>) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        db.prepare(`UPDATE sessions SET ${fields} WHERE id = ?`).run(...values, id);
    },

    get: (id: number) => {
        return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    },

    getRecent: (limit = 10) => {
        return db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?').all(limit);
    }
};

// Profile operations
export const profileQueries = {
    create: (profile: {
        linkedin_id: string;
        linkedin_url: string;
        name: string;
        headline?: string;
        company?: string;
        location?: string;
        score?: number;
        score_reason?: string;
        action_taken?: string;
        message_sent?: string;
        session_id: number;
        data?: any;
    }) => {
        const result = db.prepare(`
      INSERT INTO profiles (linkedin_id, linkedin_url, name, headline, company, location, score, score_reason, action_taken, message_sent, session_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            profile.linkedin_id,
            profile.linkedin_url,
            profile.name,
            profile.headline || null,
            profile.company || null,
            profile.location || null,
            profile.score || null,
            profile.score_reason || null,
            profile.action_taken || null,
            profile.message_sent || null,
            profile.session_id,
            profile.data ? JSON.stringify(profile.data) : null
        );
        return result.lastInsertRowid;
    },

    updateCategory: (id: number, category: string) => {
        db.prepare('UPDATE profiles SET category = ? WHERE id = ?').run(category, id);
    },

    getBySession: (sessionId: number) => {
        return db.prepare('SELECT * FROM profiles WHERE session_id = ? ORDER BY created_at DESC').all(sessionId);
    },

    getByCategory: (category: string, limit = 50) => {
        return db.prepare('SELECT * FROM profiles WHERE category = ? ORDER BY score DESC LIMIT ?').all(category, limit);
    },

    exists: (linkedinId: string) => {
        const row = db.prepare('SELECT id FROM profiles WHERE linkedin_id = ?').get(linkedinId);
        return !!row;
    }
};

// User profile operations
export const userProfileQueries = {
    save: (profile: {
        linkedin_url: string;
        name: string;
        headline?: string;
        industry?: string;
        data: any;
    }) => {
        db.prepare('DELETE FROM user_profile'); // Only keep one
        db.prepare(`
      INSERT INTO user_profile (linkedin_url, name, headline, industry, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(
            profile.linkedin_url,
            profile.name,
            profile.headline || null,
            profile.industry || null,
            JSON.stringify(profile.data)
        );
    },

    get: () => {
        const row = db.prepare('SELECT * FROM user_profile LIMIT 1').get() as any;
        if (row && row.data) {
            row.data = JSON.parse(row.data);
        }
        return row;
    }
};

// Schedule operations
export const scheduleQueries = {
    save: (schedule: {
        enabled: boolean;
        times: string[];
        days: string[];
        search_keywords: string;
    }) => {
        db.prepare('DELETE FROM schedules'); // Only keep one schedule
        db.prepare(`
      INSERT INTO schedules (enabled, times, days, search_keywords)
      VALUES (?, ?, ?, ?)
    `).run(
            schedule.enabled ? 1 : 0,
            JSON.stringify(schedule.times),
            JSON.stringify(schedule.days),
            schedule.search_keywords
        );
    },

    get: () => {
        const row = db.prepare('SELECT * FROM schedules ORDER BY id DESC LIMIT 1').get() as any;
        if (row) {
            row.times = JSON.parse(row.times);
            row.days = JSON.parse(row.days);
            row.enabled = !!row.enabled;
        }
        return row;
    }
};

export default db;
