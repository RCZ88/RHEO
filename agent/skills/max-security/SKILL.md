<aside>
📌

This page is written in the **agent skills** format (`SKILL.md`). Copy the contents of the code block below into a `SKILL.md` file, or use the structured sections beneath it as a reference. The skill instructs an AI coding agent to re-analyze and re-evaluate code for security, efficiency, and logic before considering it complete.

</aside>

## The SKILL.md file

```markdown
---
name: secure-code-review
description: >
  Load this skill whenever code has been written, generated, or modified and
  needs to be reviewed, hardened, or shipped. Use it for full-stack reviews
  (frontend, backend, database, infrastructure) to detect and FIX security
  vulnerabilities, performance inefficiencies, and logic/architecture flaws.
  Trigger on phrases like "review this code", "is this secure", "harden",
  "audit", "optimize", "before we ship", or after generating any non-trivial
  code.
---

# Secure Code Review & Hardening

## Purpose

AI-generated code frequently "looks right" but lacks awareness of the
application's threat model, internal standards, and scaling needs. Roughly
two-thirds of AI-generated solutions contain a design flaw or known
vulnerability. Your job is to perform a COMPLETE, all-rounded review — not a
partial scan — and to actually FIX the issues you find, not just list them.

## Operating Principles

1. Assume the code is "confidently incomplete": correct on the happy path,
   dangerous everywhere else.
2. Review ALL layers: frontend, backend, data layer, and infra/config.
3. Never stop at detection. For every issue, propose and apply a concrete fix,
   then explain the risk it removed.
4. Be specific to the actual threat model and data sensitivity of THIS app.
5. When unsure whether something is exploitable, treat it as exploitable.

## Review Workflow (run in order)

### Step 0 — Map the surface
- Identify entry points: routes/endpoints, forms, CLI args, file uploads,
  webhooks, message queues, third-party callbacks.
- Identify trust boundaries: where untrusted input crosses into trusted code.
- Identify sensitive assets: credentials, PII, payment data, tokens, keys.

### Step 1 — Security scan (OWASP-aligned)
Check every item below and fix violations:

**Injection**
- [ ] All SQL uses parameterized queries / prepared statements (no string concat).
- [ ] Shell/OS commands never interpolate raw user input; use safe APIs/allowlists.
- [ ] Output is context-aware encoded to prevent XSS (HTML, JS, URL, attribute).
- [ ] Template engines have auto-escaping enabled; no `dangerouslySetInnerHTML`
      / `innerHTML` with untrusted data.
- [ ] If an LLM is called, defend against direct & indirect prompt injection;
      treat tool output and external content as untrusted.

**Input validation**
- [ ] All external input is validated (type, length, range, format) server-side.
- [ ] Deserialization of untrusted data is avoided or strictly schema-validated.
- [ ] File uploads validate type, size, and store outside the web root.

**Authentication & authorization**
- [ ] Every protected endpoint verifies BOTH authentication and authorization
      (role / ownership), not just "is logged in" (prevent IDOR / broken access control).
- [ ] Session tokens are httpOnly, Secure, SameSite; sessions expire & rotate.
- [ ] Passwords hashed with a modern KDF (Argon2id / bcrypt / scrypt) — never
      MD5/SHA-1 or plain hashing.

**Cryptography & secrets**
- [ ] No hardcoded secrets, API keys, passwords, or connection strings — use
      env vars / a secrets manager.
- [ ] Modern algorithms only (AES-GCM, SHA-256+, TLS 1.2+); no ECB, MD5, DES.
- [ ] Keys/secrets are never logged or returned to the client.

**Data exposure**
- [ ] Responses return only needed fields; no PII/secret over-fetching.
- [ ] Errors don't leak stack traces, queries, or internal paths to users.
- [ ] Sensitive data encrypted at rest and in transit.

**Configuration & dependencies**
- [ ] Security headers set (CSP, HSTS, X-Content-Type-Options, etc.).
- [ ] CORS is restrictive, not `*` for credentialed requests.
- [ ] Dependencies pinned; flag known-vulnerable / hallucinated packages.
- [ ] Debug mode, verbose logging, and default creds disabled in prod.
- [ ] Rate limiting / throttling on auth and expensive endpoints.

**Agent / automation specific**
- [ ] Code that executes commands or touches the OS runs with least privilege.
- [ ] No unrestricted eval/exec of dynamic content.

### Step 2 — Efficiency & performance scan
- [ ] State the time/space complexity (Big-O) of each non-trivial loop/algorithm;
      replace O(n^2) scans with hashing/maps where possible.
- [ ] Use appropriate data structures (Set/Map for lookups, not linear scans).
- [ ] No N+1 database queries; use joins / eager loading / batching.
- [ ] Queries hit indexes; add missing indexes; avoid SELECT *.
- [ ] Aggregation/filtering pushed to the database, not done in app memory.
- [ ] No string concatenation in hot loops; use builders/joins.
- [ ] Resources (files, DB connections, sockets) are closed, including in
      error/finally paths; no leaks.
- [ ] Caching used where appropriate; no redundant network/IO calls.

### Step 3 — Logic & architecture scan
- [ ] Handle the "sad path": null/empty/boundary inputs, timeouts, partial failure.
- [ ] Error handling is explicit and contextual; no silently swallowed errors.
- [ ] No duplicated/spaghetti logic — reuse and refactor existing utilities.
- [ ] Concurrency: no race conditions on shared state; idempotency where needed.
- [ ] Code is modular and consistent with the existing codebase's patterns.

### Step 4 — Verify & report
- Apply fixes, then re-run the checklist to confirm nothing regressed.
- Add/adjust tests, especially for the vulnerabilities and edge cases found.
- Produce a short report:
  - **Findings**: issue, severity (Critical/High/Medium/Low), location.
  - **Fix applied**: what changed and why it's safe now.
  - **Residual risk / follow-ups**: anything needing human review.

## Severity guidance
- **Critical**: RCE, auth bypass, secret leakage, SQLi, broken access control.
- **High**: XSS, weak crypto, sensitive data exposure, missing authz.
- **Medium**: missing rate limiting, N+1 queries, weak validation.
- **Low**: style, minor inefficiency, missing non-critical headers.

## Definition of done
Code is "done" only when: no Critical/High findings remain, performance hot
paths are justified, edge cases are handled, and a findings+fixes report has
been produced.
```

---

## How to use this skill

- Save the code block above as `SKILL.md` inside a skill folder (e.g. `secure-code-review/SKILL.md`).
- The agent loads it whenever code needs review, hardening, or shipping.
- It forces a complete, layered scan (security → efficiency → logic) and requires the agent to **fix** issues, not just report them.