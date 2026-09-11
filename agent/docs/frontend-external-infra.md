<aside>
🎯

**Goal:** stop relying only on *prompting skills* (front-end skill, Impeccable, etc.) that tell the AI **how** to design, and give your agent real **libraries it can pull components, motion, and assets from** — connected through MCP, registries, API keys, or your own wrapper.

</aside>

<aside>
🆓

**Everything in this doc is free to use.** Where a tool needs an account or key, it's on a **free tier** (marked *free key*). Paid-only tools — Motion+ AI Kit, Figma Dev Mode seats, Magic Patterns, most Shadcnblocks/shadcn.io Pro blocks — are explicitly flagged and swapped for free alternatives.

</aside>

## TL;DR

- Skills = *instructions*. They teach taste, not inventory. They can't hand the model a real button, a real animation, or a real icon.
- The fix is **source connections**: MCP servers, shadcn registries, and asset APIs your agent can query live.
- Below: a vetted catalog (components, motion, icons, images, themes, design-to-code), the **4 connection patterns** with copy-paste config, a **build-your-own-MCP** fallback for sites with no MCP, and a drop-in **`DESIGN.md` skill** that tells the agent *when* and *where* to use each source.

---

## 1. What "AI slop" actually is

**AI slop** = generic, mass-produced output that looks like the *statistical average* of the training data — indistinguishable from every other AI build, lacking deliberate craft. The word "slop" was the 2025 Word of the Year (Merriam-Webster).

In **UI specifically**, slop has a recognizable signature:

| Tell | What it looks like |
| --- | --- |
| Default type | Inter / Geist everywhere, no pairing |
| Default accent | Purple→blue or indigo gradient hero |
| Uniform geometry | Same big border-radius + same padding on every card/button |
| Hero clichés | Tiny uppercase "eyebrow" pill above an oversized headline + one CTA |
| Scaffold labels | Repeated tiny tracked uppercase kickers above every section |
| Empty polish | Glow lights, generic stock/AI illustrations, weak pricing section, visuals that don't match the product |
| Missing motion | No real micro-interactions, or lazy default hover states |

> The root cause isn't a bad model — it's **prompting from zero**. The model invents patterns instead of pulling from real, curated, production-grade sources. Connecting libraries is what removes the guesswork.
> 

---

## 2. The mental model: Skills vs. Registries vs. MCP

**🧠 Skill / `SKILL.md`**

Instructions + taste. Tells the agent the *rules* (spacing, type scale, what slop looks like). **No inventory.**

**📦 Registry**

A hosted JSON catalog of real components the agent installs via the `shadcn` CLI into your project. Real code, your stack.

**🔌 MCP server**

A live tool the agent calls to *search, fetch, and place* components/assets. Works across Cursor, Claude Code, Windsurf, VS Code, etc.

You want **all three together**: the skill enforces taste, registries/MCP supply the real building blocks.

---

## 3. The catalog

### A. Component & block libraries (the "21st.dev style" sources)

| Source | What you get | How it connects | Auth |
| --- | --- | --- | --- |
| **21st.dev — Magic MCP** (21st.dev/magic) | Generates polished React components from a `/ui` prompt; the underlying community registry is free to browse & copy. Built to "fight AI slop" | Local MCP (npx) | ✅ Free (beta) · free key |
| **shadcn registry MCP** (ui.shadcn.com/docs/mcp) | The hub: search/install from **any** shadcn-compatible registry (official + 3rd party) by natural language | MCP + `components.json` registries | none |
| **Aceternity UI** (ui.aceternity.com) | Free Tailwind + Framer Motion blocks (heros, bento, backgrounds, shaders) — Pro templates optional, the components are free | shadcn registry + MCP | none |
| **Magic UI** (magicui.design/docs/mcp) | 150+ animated components/effects; official MCP (8 tools) | Local **or** remote MCP | none |
| **React Bits** (reactbits.dev) | 135+ animated React components (CSS + Tailwind variants) | Community MCP (npx) | none |
| **Motion Primitives** (motion-primitives.com) — *your link* | Copy-paste animated components (Motion + Tailwind) | No official MCP → use via **shadcn registry** or the `DESIGN.md` reference method | none |
| **shadcn/ui official blocks** (ui.shadcn.com/blocks) | Free official blocks (dashboards, login, sidebars). *Shadcnblocks & shadcn.io are mostly Pro/paid — stick to the official free blocks.* | shadcn MCP | ✅ Free |

<aside>
💡

**On Motion Primitives (your second link):** it has **no first-party MCP**. Two good options: (1) it's distributed as components you can wire into a shadcn registry, or (2) point your agent at its docs and let it copy-paste — covered in the build-your-own section.

</aside>

### B. Motion & animation

| Source | What you get | How it connects | Free? |
| --- | --- | --- | --- |
| **Motion (library)** (motion.dev) | The animation library itself (`motion/react`) — open source. Your agent writes Motion code directly. | npm install + the community MCP below | ✅ Free |
| **Motion.dev (community MCP)** (motion-dev-mcp) | Offline Motion docs + animation codegen for React/JS/Vue — the free way to give your agent real Motion examples | Local MCP (node) | ✅ Free |

<aside>
🚫

**Excluded (paid):** the official **Motion.dev AI Kit** (`npx motion-ai`) and its `/motion` audit require a **Motion+** subscription. Skip it — the free community MCP plus the open-source Motion library cover your animation needs.

</aside>

### C. Assets — icons, images, logos

| Source | What you get | How it connects | Auth |
| --- | --- | --- | --- |
| **Lucide icons MCP** (lucide.dev) | 1,500+ clean SVG icons, searchable, with usage code | Local MCP | none |
| **Iconify / Better Icons** (better-icons) | 200,000+ icons across 200+ sets (Lucide, Material, Heroicons, Tabler…) | MCP + CLI | none |
| **Unsplash MCP** (unsplash-smart-mcp) | Search/download real stock photos with auto-attribution | Local MCP | ✅ Free API key |
| **SVGL** (svgl.app) | Brand/logo SVGs (used by Magic for logo assets) | API / via Magic | none |

### D. Theming (kills the purple-gradient default)

| Source | What you get | How it connects |
| --- | --- | --- |
| **tweakcn** (tweakcn.com) | Full shadcn theme (light+dark CSS vars) from one color or an image — curated font pairings. Manual editor is free & open source; the AI text-to-theme is a Pro feature | Generate → copy CSS vars into your project (web tool; no MCP required) |
| **shadcn Studio / StyleGlide** | AI design-system / theme generators (free tiers available; some features paid) | Copy/export tokens |

### E. Design-to-code

<aside>
🚫

**Mostly paid — excluded.** The **Figma Dev Mode MCP** needs a paid Figma **Full/Dev seat**, and **Magic Patterns** is freemium with hard limits. Neither is completely free, so don't depend on them.

</aside>

**Free alternative — the screenshot workflow:** paste a reference screenshot (a site you like, or a free Figma Community file) into your agent and have it rebuild the layout using your **free** component MCPs (shadcn / Aceternity / Magic UI) + Motion. Design-informed codegen, zero paid seat.

- **Onlook** (onlook.com) — free, open-source visual editor for React/Tailwind; edit your live app like a design tool.

---

## 4. The 4 connection patterns

Every source above uses one of these. Learn the four and you can wire up anything.

### Pattern 1 — Local stdio MCP (npx)

The most common. The agent launches the server on your machine.

**Claude Code (CLI):**

```bash
# generic shape
claude mcp add <name> -- npx -y <package>

# examples
claude mcp add magicui -- npx -y @magicuidesign/mcp@latest
claude mcp add reactbits -- npx -y reactbits-dev-mcp-server
claude mcp add lucide -- npx -y lucide-icons-mcp
```

**Cursor / Windsurf / VS Code** (`~/.cursor/mcp.json` or project `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "magicui": {
      "command": "npx",
      "args": ["-y", "@magicuidesign/mcp@latest"]
    }
  }
}
```

Then restart the IDE. Ask the agent: *"list your magicui tools"* to confirm.

### Pattern 2 — Local MCP that needs an API key

Same as Pattern 1 but you pass the key via `env`.

**21st.dev Magic — get key at `21st.dev/magic/console`:**

```json
{
  "mcpServers": {
    "@21st-dev/magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "API_KEY": "YOUR_21ST_KEY" }
    }
  }
}
```

**Unsplash:**

```json
{
  "mcpServers": {
    "unsplash": {
      "command": "npx",
      "args": ["-y", "unsplash-smart-mcp-server"],
      "env": { "UNSPLASH_ACCESS_KEY": "YOUR_UNSPLASH_KEY" }
    }
  }
}
```

<aside>
🔐

Never paste keys into chat or commit them. Use the IDE's `env` block or a local `.env`, and keep config files out of git.

</aside>

### Pattern 3 — Remote / hosted MCP (URL + OAuth)

No local process; you point at a hosted endpoint and authenticate in the browser.

**Claude Code:**

```bash
claude mcp add --transport http <name> <https-url>
# with a token header if required:
claude mcp add --transport http <name> <url> --header "Authorization: Bearer YOUR_TOKEN"
```

**Free example — Magic UI remote:** Magic UI offers a free hosted HTTP endpoint, so you can add it by URL instead of running it locally. Add the server URL and (if prompted) complete the browser auth. *(Figma's remote MCP works the same way but needs a paid seat — skip it.)*

### Pattern 4 — shadcn registry (not MCP, but the agent's best friend)

Many libraries (Aceternity, Magic UI, custom registries) are **shadcn registries**. Register them once in `components.json`, then the **shadcn MCP** can search & install across all of them.

```json
{
  "registries": {
    "@aceternity": "https://ui.aceternity.com/registry/{name}.json",
    "@acme": "https://acme.com/r/{name}.json"
  }
}
```

Then initialize the shadcn MCP for your client (per shadcn's MCP docs) and prompt: *"Build a pricing section using blocks from @aceternity."* The agent searches the registry, fetches real source, and installs with dependencies — no copy-paste, no hallucinated props.

---

## 5. Recommended setup order (do this once)

1. **Base:** install **shadcn MCP** + add registries (`@aceternity`, any others) → instant access to thousands of real blocks.
2. **Generation:** add **21st.dev Magic** (free beta key) — or just copy components free from the site — for prompt-to-component variations.
3. **Motion:** add the **free community Motion MCP** + the open-source **Motion** library (`motion/react`) for real animation examples. *(Skip the paid Motion+ AI Kit.)*
4. **Assets:** add **Lucide/Iconify MCP** (icons, free) + **Unsplash MCP** (images, free key).
5. **Theme:** build a non-default palette + font pairing in **tweakcn**'s free editor, paste the CSS vars in.
6. **Design-to-code (optional):** use the **free screenshot workflow** or **Onlook** — skip the paid Figma Dev Mode seat.
7. Drop the **`DESIGN.md`** below into your repo so the agent knows *when/where* to use each.

---

## 6. Build-your-own MCP (fallback for sites with no MCP)

Use this when a source you love (e.g. **Motion Primitives**, a niche component site) only offers a website, docs, or a REST API.

### Option A — Wrap a documented REST API

If the site has an API (or an unofficial JSON endpoint), wrap it in a tiny MCP server. Don't 1:1 mirror endpoints — expose a few *task-shaped* tools.

```tsx
// server.ts — minimal MCP over an asset API (TypeScript SDK)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const server = new McpServer({ name: "my-assets", version: "1.0.0" })

server.tool(
  "search_components",
  { query: z.string(), limit: z.number().default(10) },
  async ({ query, limit }) => {
    const res = await fetch(
      `https://example.com/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${process.env.SOURCE_API_KEY}` } },
    )
    const data = await res.json()
    return { content: [{ type: "text", text: JSON.stringify(data) }] }
  },
)

server.tool(
  "get_component_source",
  { id: z.string() },
  async ({ id }) => {
    const res = await fetch(`https://example.com/api/components/${id}`)
    return { content: [{ type: "text", text: await res.text() }] }
  },
)

await server.connect(new StdioServerTransport())
```

Register it like any Pattern-1 server (`command: node`, `args: ["dist/server.js"]`).

### Option B — Scrape a docs site (no API)

For a copy-paste library like Motion Primitives: add a tool that fetches the component's doc page and returns the cleaned code block. Cache results, respect the site's terms/robots, and prefer official source over scraped HTML when available.

```tsx
server.tool(
  "fetch_motion_primitive",
  { slug: z.string() }, // e.g. "text-scramble"
  async ({ slug }) => {
    const html = await (await fetch(`https://motion-primitives.com/docs/${slug}`)).text()
    const code = extractCodeBlocks(html) // your HTML→code helper
    return { content: [{ type: "text", text: code }] }
  },
)
```

### Option C — No-build shortcut

If you don't want to run a server at all: keep a **local `assets/` index** (a markdown or JSON file listing the components/snippets you trust, with source URLs) and reference it from `DESIGN.md`. The agent reads the index, fetches the snippet, and adapts it. Lowest power, zero setup.

<aside>
⚖️

Scraping caveat: check each site's terms and `robots.txt`, throttle requests, and never redistribute paid/licensed assets. For licensed libraries (Aceternity Pro, Motion+), use their official MCP/registry instead of scraping.

</aside>

---

## 7. Drop-in skill: `DESIGN.md`

Save this in your repo root (or as a skill) so the agent knows the rules **and** which connected source to reach for. This is the piece that makes the libraries get used *correctly*, in the *right spot*.

```markdown
# DESIGN.md — UI build rules for this project

## Prime directive
Never design from zero. Pull from connected sources, then adapt to our tokens.
If a source isn't available, say so — do not invent a substitute that looks generic.

## Source routing (what to use, when)
- Whole sections/blocks (hero, pricing, bento, features) → shadcn MCP via @aceternity / registries.
- A specific component variation from a description → 21st.dev Magic (/ui ...).
- Any animation / transition / scroll effect → free Motion community MCP + Motion docs; write motion/react code directly.
- Icons → Lucide first; Iconify only if Lucide lacks it. Never use emoji as UI icons.
- Photography → Unsplash MCP. Include attribution. No random AI-generated hero images.
- Color + type system → use the tweakcn-generated tokens in globals.css. Do NOT introduce ad-hoc colors.

## Anti-slop checklist (block the PR if any fail)
- [ ] Type: NOT default Inter/Geist-only. Use the project's paired display + body fonts.
- [ ] Color: NOT purple/indigo gradient-on-everything. Use defined tokens; gradients are intentional, rare.
- [ ] Geometry: radius + padding come from the scale, not the same value on every element.
- [ ] Hero: no tiny uppercase eyebrow pill + oversized headline + lone CTA cliché.
- [ ] Sections: no repeated tracked-uppercase kicker label above every heading.
- [ ] Motion: real micro-interactions on key actions; respects prefers-reduced-motion.
- [ ] Imagery: matches the actual product; no filler glow/blobs.
- [ ] Empty/loading/error states exist and are styled.

## Placement rules
- One focal element per viewport; establish hierarchy with scale + weight, not borders.
- Motion supports meaning (entrance, state change, feedback) — never decoration-only.
- Reuse installed components; do not re-implement an existing primitive.
- Keep all design decisions traceable to a token or a sourced component.

## Workflow
1. Restate the screen's job + the one action that matters.
2. Pull candidate blocks/components from the routed source.
3. Re-skin to our tokens (color, type, radius, spacing).
4. Add motion with the Motion library (motion/react), referencing the free Motion MCP examples.
5. Run the anti-slop checklist before finishing.
```

---

## 8. Quick reference

| Need | Reach for | Connect via |
| --- | --- | --- |
| Real blocks/sections | shadcn MCP + Aceternity | Registry + MCP |
| Prompt → component | 21st.dev Magic | Local MCP + free key |
| Animation | Motion library + community MCP | npm + Local MCP |
| Icons | Lucide / Iconify MCP | Local MCP |
| Photos | Unsplash MCP | Local MCP + free key |
| Theme/tokens | tweakcn | Copy CSS vars |
| Design-to-code | Screenshot → free component MCPs / Onlook | ✅ Free |
| Site with no MCP | Build your own (Sec. 6) | Custom MCP / index |

<aside>
📌

Install commands for hosted tools change often — always confirm the exact `npx`/CLI string on each tool's official MCP docs page (linked in the catalog) before running. The **patterns** above stay stable even when package names update.

</aside>