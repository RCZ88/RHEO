# PROMPT: Fix Netlify 404 — Static Export Not Being Served (Attempt 2)

## Raw Request
"it always say website not found thing... its not working properly. still link not found on the website."

## Problem Statement
Netlify build succeeds but site shows 404 "Page not found" for all routes.
Build produces static output in `landing/out/` but Netlify publishes from `landing/.next`.

## Key Evidence
```
Custom publish path detected. Proceeding with the specified path: 'landing/.next'
Starting to deploy site from 'landing/.next'
0 new function(s) to upload
Site is live ✨
```

Despite netlify.toml having `publish = "out"` and `NETLIFY_NEXT_PLUGIN_SKIP = "true"`, Netlify STILL publishes from `.next`.

## Context Bundle
Read `CONTEXT_BUNDLE.md` in this folder first. It contains the full netlify.toml, next.config.ts, and build log evidence.

## Engineering Task
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