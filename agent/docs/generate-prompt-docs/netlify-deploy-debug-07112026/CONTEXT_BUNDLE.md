# CONTEXT BUNDLE: Netlify Deployment Debug

## Problem
Netlify build succeeds but site shows 404 "Page not found" for all routes.
Build produces static output in `landing/out/` but Netlify can't find/serve it.

## Current Configuration

### netlify.toml (repo root)
```toml
[build]
  base    = "landing"
  command = "npm run build"
  publish = "out"

[build.environment]
  NODE_VERSION = "22"

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
  "dev": "next dev -p 3000 > dev.log 2>&1",
  "build": "next build",
  "start": "next start -p 3003",
  "lint": "eslint ."
}
```

## Build Output (local)
```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /docs
├ ○ /docs/ai
├ ○ /docs/data
├ ○ /docs/faq
├ ○ /docs/network
└ ○ /docs/phases

○  (Static)  prerendered as static content
```

Local `landing/out/` contains:
- index.html, index.txt
- docs.html, docs.txt
- docs/ai.html, docs/ai.txt
- docs/data.html, docs/data.txt
- docs/faq.html, docs/faq.txt
- docs/network.html, docs/network.txt
- docs/phases.html, docs/phases.txt
- 404.html, _not-found.html
- media/ (screenshots)
- _next/ (JS/CSS chunks)
- favicon.svg, logo.svg, og.svg, robots.txt

## Build Log (from Netlify)
```
Custom publish path detected. Proceeding with the specified path: 'landing/.next'
...
Starting to deploy site from 'landing/.next'
Calculating files to upload
56 new file(s) to upload
0 new function(s) to upload
Site is live ✨
```

Wait — it says "Starting to deploy site from 'landing/.next'" but netlify.toml says `publish = "out"`. This suggests Netlify is NOT reading the `publish = "out"` from netlify.toml, or it's cached.

## Key Observations
1. Build succeeds (no errors)
2. Site shows 404 for all routes
3. Build publishes from `.next` not `out` (despite netlify.toml saying `publish = "out"`)
4. 0 functions uploaded (expected for static export, but the files aren't being served)
5. The `publish = "out"` in netlify.toml doesn't seem to take effect

## Possible Causes
1. Netlify dashboard has a "Publish directory" override that takes precedence over netlify.toml
2. The build cache is stale and using old config
3. The `out/` directory isn't being found (maybe build output goes elsewhere)
4. Netlify's Next.js framework detection overrides the publish directory

## What We Need
A working Netlify deployment that serves the static Next.js export from `landing/out/`.