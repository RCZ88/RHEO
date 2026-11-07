# PROMPT: Fix Netlify 404 — Static Export Not Being Served

## Problem
Netlify build succeeds but site shows 404 "Page not found" for all routes.
Build produces static output in `landing/out/` but Netlify publishes from `landing/.next`.

## Key Evidence from Build Log
```
Custom publish path detected. Proceeding with the specified path: 'landing/.next'
Starting to deploy site from 'landing/.next'
Calculating files to upload
56 new file(s) to upload
0 new function(s) to upload
Site is live ✨
```

Despite netlify.toml having `publish = "out"` and `NETLIFY_NEXT_PLUGIN_SKIP = "true"`, Netlify STILL publishes from `.next`.

## Current Configuration

### netlify.toml (repo root)
```toml
[build]
  base    = "landing"
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "22"
  NETLIFY_NEXT_PLUGIN_SKIP = "true"

[[headers]]
  for = "/media/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy        = "strict-origin-when-cross-origin"
    X-Frame-Options        = "SAMEORIGIN"
```

### landing/next.config.ts
```typescript
const nextConfig: NextConfig = {
  output: "export",
  images: {
    remotePatterns: [...],
    unoptimized: true,
  },
};
```

### landing/package.json (scripts)
```json
{
  "build": "next build"
}
```

## What We've Tried
1. Changed production branch from `refactor/architecture-base` to `main` ✅
2. Added `output: "export"` to next.config.ts ✅ (build produces `out/` locally)
3. Added `publish = "out"` to netlify.toml ✅
4. Added `NETLIFY_NEXT_PLUGIN_SKIP = "true"` ✅
5. Added `@netlify/plugin-nextjs` to devDeps (then removed plugin from toml)
6. Removed the API route (hello world) since it's not used

## What STILL Happens
- Build succeeds
- Netlify publishes from `landing/.next` (NOT `landing/out`)
- 0 functions uploaded
- Site shows 404 for all routes

## What We Need
1. Diagnose WHY Netlify ignores `publish = "out"` and uses `.next`
2. Fix the configuration so Netlify serves from `landing/out`
3. Ensure all routes work (/, /docs, /docs/ai, /docs/data, /docs/faq, /docs/network, /docs/phases)

## Possible Causes to Investigate
1. Netlify dashboard has "Publish directory" override set to `.next`
2. `NETLIFY_NEXT_PLUGIN_SKIP` env var not being applied
3. The OpenNext adapter is auto-activating despite the skip flag
4. Netlify's framework detection is overriding the publish directory
5. Build cache is stale

## Constraints
- Do NOT change the landing page code (it works locally)
- Only fix the Netlify deployment configuration
- The site must serve all routes without 404

## Expected Outcome
- Netlify deploys from `landing/out`
- All routes return 200
- Screenshots and assets load correctly