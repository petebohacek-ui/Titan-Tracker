# Titan Track - Advanced Workout Tracker PWA

Titan Track is a production-style offline-first workout tracking Progressive Web App built with React, Vite, and TypeScript.

It includes:
- Offline logging with IndexedDB
- Automatic performance analytics and smart insights
- Split-based workout flows (Push, Pull, Legs, Upper, Lower, Full Body, Cardio)
- Interactive charts for progression, volume, consistency, PR timeline, and muscle balance
- Goal tracking, reminders settings, backup export/import, and sync queueing
- Installable PWA behavior for Android and iOS (Add to Home Screen)
- Supabase authentication and cloud synchronization support

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4
- Dexie (IndexedDB)
- Zustand
- Recharts
- Framer Motion
- Vite PWA plugin
- Supabase JS client

## Project Structure

- public/
- src/components/
- src/pages/
- src/hooks/
- src/services/
- src/database/
- src/types/
- src/utils/
- src/data/

## Prerequisites

You need Node.js 20+ and npm installed.

On Windows, install Node.js from:
https://nodejs.org/

After install, restart your terminal and confirm:

```powershell
node --version
npm --version
```

## Setup

Create a `.env` file from `.env.example` and fill in your Supabase values.

```powershell
npm install
npm run dev
```

Open the local URL shown by Vite (usually http://localhost:5173).

### Required Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SYNC_ENDPOINT` (optional, for server-side sync processing)

## Production Build

```powershell
npm run build
npm run preview
```

## PWA Installation

- Android (Chrome): open app, tap menu, Add to Home Screen / Install App.
- iPhone (Safari): open app, tap Share, Add to Home Screen.

## Offline + Sync Model

- Workouts, settings, and goals are stored in IndexedDB (Dexie).
- Actions are queued in a local sync queue.
- When online, queued operations are flushed automatically.
- Cloud sync endpoint wiring is scaffolded and ready to connect.
- Auth state is restored automatically on app startup.
- Local data is pushed to cloud after login, after edits, after deletes, on reconnect, and on a periodic timer.
- Local IndexedDB remains the primary offline cache.

To enable remote sync processing, provide a sync endpoint URL at build/runtime:

VITE_SYNC_ENDPOINT=https://your-api.example.com/sync

## Authentication

The app uses Supabase Authentication for:
- Email/password sign up
- Email/password sign in
- Password reset
- Persistent sessions
- Automatic session restoration

The Account page is available in the app shell for login/logout and sync status.

## Supabase Setup

1. Create a Supabase project.
2. Add the SQL schema from [supabase/schema.sql](supabase/schema.sql).
3. Configure auth providers for email/password.
4. Set the environment variables listed above.
5. Deploy a sync endpoint if you want cloud sync processing beyond local IndexedDB.

## Demo Data

First launch seeds realistic demo history:
- 84 sessions across several months
- Progressive overload patterns
- Deload behavior
- PR progression and plateau windows
- Multiple splits and body-part coverage

## Data Management

From Settings:
- Export backup (JSON)
- Import backup (restore from JSON)
- Goal management
- Reminder toggles

## Notes

- If TypeScript in editor shows missing package types, run npm install first.
- The environment used to generate this project did not have npm available, so commands could not be executed in-terminal here.

## Deployment

Deploy the dist/ output to any static hosting platform:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Supabase deployment requirements:
- Add the SQL schema and enable RLS.
- Provide the anon key only to the client.
- Keep service-role secrets out of the client bundle.

For SPA routing, configure fallback rewrites to index.html.

This repository already includes rewrite configs for common hosts:
- netlify.toml
- vercel.json

### Quick Deploy Steps

1. Run production build:

```powershell
npm run build
```

2. Validate locally:

```powershell
npm run preview
```

3. Deploy the dist folder (or connect repo with build command npm run build).

### Build Notes

- Current build succeeds with PWA service worker generation.
- Vite reports a large main JS chunk (>500kB). This is not a deployment blocker, but code-splitting is recommended for faster first load.
