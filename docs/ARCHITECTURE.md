# Architecture Document
## LinkScope - Technical Architecture

**Version**: 1.0  
**Last Updated**: 2025-12-14

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LINKSCOPE SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│   │   Dashboard  │────▶│  API Server  │────▶│  Bot Engine  │       │
│   │   (Web UI)   │◀────│   (Express)  │◀────│  (Playwright)│       │
│   └──────────────┘     └──────────────┘     └──────────────┘       │
│          │                    │                    │                │
│          │                    ▼                    │                │
│          │             ┌──────────────┐            │                │
│          │             │   Scheduler  │            │                │
│          │             │  (node-cron) │            │                │
│          │             └──────────────┘            │                │
│          │                    │                    │                │
│          ▼                    ▼                    ▼                │
│   ┌─────────────────────────────────────────────────────────┐      │
│   │                    SQLite Database                       │      │
│   │  [profiles] [sessions] [config] [user_profile] [logs]   │      │
│   └─────────────────────────────────────────────────────────┘      │
│                              │                                      │
│                              ▼                                      │
│                    ┌──────────────────┐                            │
│                    │    AI Service    │                            │
│                    │  (OpenAI / Local)│                            │
│                    └──────────────────┘                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Frontend (Dashboard)
**Tech**: Vanilla HTML/CSS/JS (no framework bloat)

| Module | Responsibility |
|--------|---------------|
| `index.html` | Page structure, semantic HTML |
| `styles.css` | Dark theme, layout, animations |
| `app.js` | API calls, state management, UI updates |

**Design Principles**:
- No gradients (clean flat design)
- Custom icons (no generic icon packs)
- Minimal color palette (3-4 colors max)
- Clear visual hierarchy

### 2.2 API Server
**Tech**: Express.js + TypeScript

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Trigger LinkedIn login flow |
| `/api/auth/status` | GET | Check login status |
| `/api/session/start` | POST | Begin automation session |
| `/api/session/stop` | POST | Stop current session |
| `/api/session/status` | GET | Get live session stats |
| `/api/config` | GET/PUT | Get/update bot configuration |
| `/api/profiles` | GET | Retrieve visited profiles |
| `/api/schedule` | GET/PUT | Manage schedule settings |

### 2.3 Bot Engine
**Tech**: Playwright (Chromium)

| Module | Responsibility |
|--------|---------------|
| `auth.ts` | Handle LinkedIn login, cookie management |
| `scraper.ts` | Extract profile data from page |
| `actions.ts` | View, connect, follow operations |
| `engine.ts` | Orchestrate session flow |
| `delays.ts` | Human-like timing utilities |

**Key Decisions**:
- Visible browser (not headless) - reduces detection
- One browser instance per session
- Selector abstraction for maintainability

### 2.4 AI Service
**Tech**: OpenAI API (or Ollama for local)

| Module | Responsibility |
|--------|---------------|
| `scorer.ts` | Score profile match (0-100) |
| `messages.ts` | Generate connection messages |
| `analyzer.ts` | Analyze user's own profile |
| `categorizer.ts` | Post-session categorization |

**Scoring Algorithm**:
```
Score = weighted_sum(
  industry_match × 0.25,
  role_relevance × 0.25,
  seniority_fit × 0.15,
  mutual_connections × 0.15,
  company_signals × 0.10,
  engagement_signals × 0.10
)
```

### 2.5 Scheduler
**Tech**: node-cron

- Persists schedule to database
- Triggers session start at configured times
- Handles timezone considerations
- Prevents overlapping sessions

### 2.6 Database
**Tech**: SQLite (better-sqlite3)

**Schema**:
```sql
-- User's own profile analysis
CREATE TABLE user_profile (
  id INTEGER PRIMARY KEY,
  data JSON,
  analyzed_at DATETIME
);

-- Visited profiles
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY,
  linkedin_id TEXT UNIQUE,
  name TEXT,
  headline TEXT,
  company TEXT,
  location TEXT,
  data JSON,
  score INTEGER,
  score_reason TEXT,
  action_taken TEXT,
  session_id INTEGER,
  created_at DATETIME
);

-- Session logs
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  started_at DATETIME,
  ended_at DATETIME,
  profiles_viewed INTEGER,
  connections_sent INTEGER,
  status TEXT,
  config JSON
);

-- Bot configuration
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value JSON
);
```

---

## 3. Data Flow

### 3.1 Login Flow
```
User clicks "Login"
       │
       ▼
API receives request → Bot opens browser
       │
       ▼
User logs in manually (handles 2FA, captcha)
       │
       ▼
Bot detects successful login → Saves cookies
       │
       ▼
API returns success → Dashboard shows "Connected"
```

### 3.2 Session Flow
```
User clicks "Start" or Schedule triggers
       │
       ▼
Engine loads config + user profile from DB
       │
       ▼
Bot navigates to LinkedIn search with keywords
       │
       ▼
┌─────────────────────────────────────────┐
│ LOOP (until 100 profiles or 1 hour)     │
├─────────────────────────────────────────┤
│ 1. Click next profile from results      │
│ 2. Scraper extracts profile data        │
│ 3. AI scores profile against user       │
│ 4. If score ≥ threshold:                │
│    - Generate AI message                │
│    - Send connection request            │
│    - Follow profile                     │
│ 5. Save profile to database             │
│ 6. Emit progress event to dashboard     │
│ 7. Random delay (3-8 seconds)           │
│ 8. Navigate back to search              │
└─────────────────────────────────────────┘
       │
       ▼
Session ends → Categorize profiles → Update stats
```

---

## 4. Security Considerations

| Risk | Mitigation |
|------|------------|
| LinkedIn credentials | Never stored; cookie-based auth only |
| OpenAI API key | Environment variable, never in code |
| Session hijacking | Local-only server (localhost) |
| Rate limiting | Conservative delays, session limits |

---

## 5. File Structure

```
Project X/
├── docs/
│   ├── PRD.md              # Product requirements
│   ├── ARCHITECTURE.md     # This document
│   └── CHANGELOG.md        # Version history
│
├── src/
│   ├── server.ts           # Express entry point
│   │
│   ├── api/
│   │   ├── routes.ts       # All API routes
│   │   └── middleware.ts   # Error handling, logging
│   │
│   ├── bot/
│   │   ├── engine.ts       # Session orchestrator
│   │   ├── auth.ts         # Login & cookies
│   │   ├── scraper.ts      # Profile data extraction
│   │   ├── actions.ts      # View, connect, follow
│   │   └── delays.ts       # Human-like timing
│   │
│   ├── ai/
│   │   ├── scorer.ts       # Profile scoring
│   │   ├── messages.ts     # Connection messages
│   │   ├── analyzer.ts     # User profile analysis
│   │   └── categorizer.ts  # Post-session categorization
│   │
│   ├── scheduler/
│   │   └── jobs.ts         # Cron job management
│   │
│   └── db/
│       ├── sqlite.ts       # Database connection
│       ├── schema.sql      # Table definitions
│       └── queries.ts      # Prepared statements
│
├── public/
│   ├── index.html          # Dashboard
│   ├── styles.css          # Styling
│   └── app.js              # Frontend logic
│
├── data/                   # Runtime data (gitignored)
│   └── linkscope.db        # SQLite database
│
├── .env.example            # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Development Phases

### Phase 1: Foundation
- [ ] Project setup, dependencies
- [ ] Database schema
- [ ] Basic Express server

### Phase 2: Authentication
- [ ] Login flow with Playwright
- [ ] Cookie persistence
- [ ] Status endpoint

### Phase 3: Bot Core
- [ ] Search navigation
- [ ] Profile scraping
- [ ] View action

### Phase 4: AI Integration
- [ ] User profile analysis
- [ ] Profile scoring
- [ ] Message generation

### Phase 5: Actions
- [ ] Connect with message
- [ ] Follow action
- [ ] Session limits

### Phase 6: Dashboard
- [ ] UI structure
- [ ] Styling (dark theme)
- [ ] API integration
- [ ] Real-time updates

### Phase 7: Scheduling
- [ ] Cron setup
- [ ] Schedule UI
- [ ] Persistence

### Phase 8: Analytics
- [ ] Categorization
- [ ] History view
- [ ] Export
