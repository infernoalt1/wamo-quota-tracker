# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WAMO Quota Tracker - a math problem submission platform that manages problem submissions, voting/curation workflow, and contest round composition for math competitions.

## Development Commands

```bash
# Install dependencies
npm install

# Run full development stack (frontend + backend concurrently)
npm run dev:full

# Run frontend only (Vite dev server on port 5173)
npm run dev

# Run backend only (Express server on port 3000)
npm run start:server

# Production build
npm run build

# Preview production build
npm run preview

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

## Architecture

### Tech Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Framer Motion
- **Backend:** Express.js + PostgreSQL
- **Auth:** JWT tokens (stored in localStorage, passed as Bearer header)
- **Math Rendering:** KaTeX for LaTeX (`$...$` inline, `$$...$$` block)

### Key Files
- `App.tsx` - Main React component containing all views and state (~2900 lines)
- `api.ts` - Frontend API client with all backend endpoints
- `server.js` - Express backend with all routes and database logic
- `types.ts` - Shared TypeScript type definitions
- `utils.ts` - Utility functions (LaTeX parsing, validation)
- `db_schema.sql` - PostgreSQL schema documentation
- `components/` - Reusable React components (Button, ProblemCard, ProblemModal, MathText)

### Data Flow
```
Frontend (React) → api.ts → Express routes (server.js) → PostgreSQL
```

### Problem Status Workflow
```
pending (Waitlist) → approved (Pool) → accepted (Round)
```

### Core Data Models
- **User** - Roles: admin, director, writer, guest
- **Problem** - Math problems with LaTeX statements, solutions, voting scores
- **Quota** - Submission cycles with targets
- **Round** - Curated collections of problems for contests

### API Structure
- Auth: `/auth/login`, `/auth/register`, `/auth/guest-login`, `/auth/me`
- Problems: `/api/problems` (CRUD, voting, comments, bulk-parse)
- Quotas: `/api/quotas` (CRUD)
- Rounds: `/api/rounds` (CRUD, reorder)
- Users: `/api/users` (list, update, delete)

## Environment Variables

Required in `.env.local` (copy from `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Session signing key
- `API_KEY` - Gemini API key (for AI features)
- `VITE_API_URL` - Backend URL

## Key Patterns

- All frontend state managed in single App component with prefixed naming (`[view]Sort`, `[view]Filter*`, `editing*`)
- API client (`api.ts`) has a `USE_MOCK_BACKEND` toggle for offline development
- Optimistic concurrency control using version field on problems
- Database auto-initializes tables and seeds default users on startup (admin@probfair.org / admin123)
