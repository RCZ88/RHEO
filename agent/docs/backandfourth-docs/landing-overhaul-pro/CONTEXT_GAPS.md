# Context Gap Analysis — RHEO Landing Page Professional Overhaul

| Context Needed | Status | Location | How to Obtain |
|----------------|--------|----------|---------------|
| Current landing page structure (5 sections) | ✅ Have | `landing/src/app/page.tsx` | Already in bundle |
| LAMINAR design system tokens | ✅ Have | `landing/src/app/globals.css` (lines 1-2000) | Already in bundle |
| Hero section (flow field, CTAs, live line) | ✅ Have | `landing/src/components/rheo/Hero.tsx` | Already in bundle |
| ActRecord scrub section (300vh, video scrub) | ✅ Have | `landing/src/components/rheo/ActRecord.tsx` | Already in bundle |
| Gallery (17 screens, rail, index, ASCII seam) | ✅ Have | `landing/src/components/rheo/Gallery.tsx` | Already in bundle |
| ActUnderstand (AI Console, 3 scenarios) | ✅ Have | `landing/src/components/rheo/ActUnderstand.tsx` | Already in bundle |
| Download (waitlist, OS cards, Ledger, versions) | ✅ Have | `landing/src/components/rheo/Download.tsx` | Already in bundle |
| Navigation, SectionIndex, DayRuler, Footer | ✅ Have | `landing/src/components/rheo/Nav.tsx`, `SectionIndex.tsx`, `DayRuler.tsx`, `Footer.tsx` | Already in bundle |
| Previous GLM RESULT.md (v1.2) | ✅ Have | `agent/docs/generate-prompt-docs/landing-page-restructure-07102026/RESULT.md` | Already in bundle |
| RHEO_LANDING_CONTEXT.md (audit + priorities) | ✅ Have | `landing/RHEO_LANDING_CONTEXT.md` | Already in bundle |
| LANDING_DESIGN_SPEC.md (style contract) | ✅ Have | `landing/design/LANDING_DESIGN_SPEC.md` | Already in bundle |
| Real media assets (17 stills, 7 recordings) | ✅ Have | `landing/public/media/` | 24 files, all tracked |
| shadcn/ui component primitives available | ✅ Have | `landing/src/components/ui/` | 40+ components |
| framer-motion patterns in use | ✅ Have | Multiple components | Already in bundle |
| Reduced-motion architecture (store + media query) | ✅ Have | `use-motion-preference.ts`, globals.css | Already in bundle |
| **What professional "spec" pages look like** | ❌ Missing | External reference | Specialist must provide examples (Stripe, Linear, Vercel, Notion, etc.) |
| **Content strategy for "documentation/spec" feel** | ❌ Missing | External reference | Specialist must define structure |
| **Conversion-focused CTA hierarchy** | ❌ Missing | External reference | Specialist must define |
| **Trust signals for pre-launch product** | ❌ Missing | External reference | Specialist must define |
| **Mobile-first responsive breakpoints** | ⚠️ Partial | globals.css has some | Need full audit |
| **Accessibility compliance (WCAG 2.2)** | ⚠️ Partial | OWED 3 lists gaps | Need full audit |

---

**Rule:** If a gap exists, the Initial Prompt must explicitly say: *"We do not yet have [X]. If you need it, ask and we will fetch it."*

**Gaps for Specialist to fill:**
1. Reference sites that achieve "professional documentation/specification" feel
2. Content architecture for a page that communicates both product AND technical depth
3. CTA strategy for pre-launch waitlist conversion
4. Trust signal patterns for "local-first, zero-telemetry" products
5. Mobile/responsive strategy for complex scroll-driven sections