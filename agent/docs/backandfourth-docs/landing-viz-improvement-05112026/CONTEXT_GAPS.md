# Context Gap Analysis

## Context Needed vs. Available

| Context Needed | Status | Location | How to Obtain |
|----------------|--------|----------|---------------|
| SampleDayTimeline.tsx source | ✅ Have | landing/src/components/rheo/SampleDayTimeline.tsx | Embedded in CONTEXT_BUNDLE.md |
| Download.tsx source | ✅ Have | landing/src/components/rheo/Download.tsx | Embedded in CONTEXT_BUNDLE.md |
| Hero.tsx source | ✅ Have | landing/src/components/rheo/Hero.tsx | Embedded in CONTEXT_BUNDLE.md |
| Dayfield.tsx source | ✅ Have | landing/src/components/rheo/Dayfield.tsx | Embedded in CONTEXT_BUNDLE.md |
| ActRecord.tsx (parent) | ❌ Missing | landing/src/components/rheo/ActRecord.tsx | Agent can fetch if GLM requests |
| Global CSS/tokens | ⚠️ Partial | landing/src/app/globals.css | Key tokens included in CONTEXT_BUNDLE.md |
| Hairline figure source (Vault, Exploded) | ❌ Missing | node_modules/@lucasmarkes/hairline/ | Agent can fetch if GLM requests |
| Gallery component (for comparison) | ❌ Missing | landing/src/components/rheo/Gallery.tsx | Agent can fetch if GLM requests |
| sample-day.json (data shape) | ⚠️ Partial | landing/data/sample-day.json | Summary included, full file available on request |

## Missing Context Notes
- ActRecord.tsx wraps SampleDayTimeline and controls the scroll-scrub. GLM may need it to understand the 300vh scroll container.
- The hairline figure source is in node_modules and is minified. GLM may need to understand the figure API (intensity, theme, label props).
- Full CSS tokens are in globals.css. Key values are included in the CONTEXT_BUNDLE.md design system section.

## Rule
If GLM needs any of the missing context, it should ask using: `REQUEST: [specific file or clarification]`
The Project Owner will fetch and respond with: `CONTEXT: [file path] [actual source code]`