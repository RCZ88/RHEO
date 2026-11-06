# Netlify Production Branch Fix

## Problem
Netlify is deploying from `refactor/architecture-base` instead of `main`.
All new landing page work is on `main`. The production site shows the old landing page.

## What's on `main` (new work)
- 14 re-shot app screenshots (Dashboard, Activity, Insights, Life, AI, IDE, Finance, Lyceum, Labs, Guide, Settings, Console, Database, Rankings)
- SampleDayTimeline fused panel (HUD, keyboard, facts line)
- Download tabbed Vault/Layers figure
- ActRecord wider instrument (1000px)
- All docs pages fleshed out
- Zero banned strings

## What's on `refactor/architecture-base` (old work)
- Old 11-section landing layout
- Old screenshots
- Outdated content

## Fix Steps

### Step 1: Change production branch in Netlify dashboard
1. Go to https://app.netlify.com
2. Select the RHEO site
3. Go to Site settings → Build & deploy → Continuous deployment
4. Under "Production branch", change from `refactor/architecture-base` to `main`
5. Click Save

### Step 2: Trigger a new deploy
1. Go to Deploys tab
2. Click "Trigger deploy" → "Deploy site"
3. Wait for build to complete (~30-60 seconds)

### Step 3: Verify
1. Visit the production URL
2. Check that the new landing page is showing (should have "A SAMPLE DAY" section, tabbed Vault/Layers figure)
3. Check that screenshots are loading (no broken images)
4. Check that docs pages work (/docs, /docs/data, /docs/network, etc.)

### Alternative: If you can't access the Netlify dashboard
Ask CZ to:
1. Change the production branch to `main` in the Netlify dashboard
2. Trigger a deploy
3. Verify the new landing page is live

### Netlify build settings (verify these are correct)
- Build command: `npm run build` (or `cd landing && npm run build`)
- Publish directory: `landing/.next` or `landing/out` (depending on Next.js config)
- Node version: 18+ (check netlify.toml or .nvmrc)

### Common issues
- If build fails: check the deploy log for errors (usually missing env vars or Node version mismatch)
- If old content shows: clear browser cache (Ctrl+Shift+R) or check if CDN is caching
- If images are broken: verify they exist in `landing/public/media/` and are committed to `main`