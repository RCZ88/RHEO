# PROMPT: Fix Netlify 404 for RHEO Landing Page

## Raw Request
"it always say website not found thing... its not working properly. still link not found on the website."

## Problem Statement
Netlify build succeeds but site shows 404 "Page not found" for all routes.
The build produces static output but Netlify can't find/serve it.

## Context Bundle
Read `CONTEXT_BUNDLE.md` in this folder first.

## Key Evidence
The build log says: "Starting to deploy site from 'landing/.next'" despite netlify.toml saying `publish = "out"`. This means Netlify is NOT reading the publish directory from netlify.toml, or it's cached.

## Engineering Task
1. Diagnose why Netlify deploys from `.next` instead of `out`
2. Fix the configuration so Netlify serves from `landing/out`
3. Ensure all routes work (/, /docs, /docs/ai, /docs/data, /docs/faq, /docs/network, /docs/phases)

## Possible Fixes to Investigate
1. Check if Netlify dashboard has a "Publish directory" override
2. Check if the `publish` in netlify.toml is being ignored
3. Try removing `publish` from netlify.toml and letting Netlify auto-detect
4. Try adding a `_redirects` file in `landing/public/`
5. Check if `output: "export"` is actually producing the `out/` directory on Netlify's build
6. Check if there's a caching issue with the build

## Constraints
- Do NOT change the landing page code (it works locally)
- Only fix the Netlify deployment configuration
- The site must serve all routes without 404

## Files to Modify
- netlify.toml (root)
- landing/next.config.ts (if needed)
- landing/public/_redirects (if needed)

## Expected Outcome
- Netlify deploys from `landing/out` (or wherever the static export goes)
- All routes return 200, not 404
- Screenshots and assets load correctly