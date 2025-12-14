---
description: Development workflow for LinkScope with incremental commits
---

# Development Workflow

This workflow ensures clean, incremental development with proper version control.

## Before Starting Any Feature

1. Make sure you're on the main branch:
```bash
git checkout main
git pull
```

2. Create a feature branch:
```bash
git checkout -b feature/<feature-name>
```

## During Development

3. After each logical unit of work, commit:
```bash
git add .
git commit -m "<type>: <description>"
```

**Commit Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code restructuring
- `docs:` Documentation
- `style:` Formatting, no code change
- `test:` Adding tests

4. Test the feature works before moving on:
- Run the dev server
- Manually verify functionality
- Check console for errors

## After Completing Feature

5. Update CHANGELOG.md with the changes

6. Merge to main:
```bash
git checkout main
git merge feature/<feature-name>
```

7. If removing features, clean up:
- Remove unused code
- Remove unused imports
- Update docs to reflect current state

## Rollback If Needed

To go back to before a feature:
```bash
git log --oneline  # Find commit hash
git checkout <commit-hash>
```

## Development Phases

### Phase 1: Foundation
// turbo
```bash
npm init -y
npm install express playwright better-sqlite3 node-cron openai typescript @types/node @types/express ts-node
npx tsc --init
```

### Phase 2: Core Structure
Create files in order:
1. `src/db/schema.sql` → `src/db/sqlite.ts`
2. `src/server.ts`
3. Test server runs

### Phase 3: Bot Module
Build incrementally:
1. `src/bot/auth.ts` - Test login works
2. `src/bot/scraper.ts` - Test data extraction
3. `src/bot/actions.ts` - Test each action
4. `src/bot/engine.ts` - Combine all

### Phase 4: AI Module
1. `src/ai/analyzer.ts` - Test profile analysis
2. `src/ai/scorer.ts` - Test scoring
3. `src/ai/messages.ts` - Test message generation

### Phase 5: Dashboard
1. `public/styles.css` - Get styling right first
2. `public/index.html` - Structure
3. `public/app.js` - Functionality

// turbo-all
