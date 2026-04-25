# Kami — Strategy

## Bounty

**Eitherway Track — Frontier Hackathon 2026**  
Prize pool: $20,000 USDC (Grand $5K + 5 × $3K partner tracks)  
Deadline: **2026-05-12** (submission), **2026-05-27** (winner announcement)  
Primary track: **Kamino**  
Grand Prize eligibility: yes (all tracks compete)

## Thesis

Eitherway judges want a live, production-quality dApp that proves their AI platform produces shippable products, deeply integrated with a partner protocol. A conversational Kamino co-pilot (Kami) is:

- **The most recursive dogfood**: their pitch is "prompt → production app"; Kami is "prompt → production DeFi action."
- **Naturally retentive**: chat UIs pull users back (vs. a dashboard they glance at once).
- **Virally demo-able**: screenshots of "my AI rebalanced my Kamino leverage" tweet themselves.
- **Rubric-aligned**: hits real-world utility, product quality, Kamino integration depth, and adoption potential (the full 100%).

## Approach — Ω (Eitherway-genesis + local-primary)

| Phase | Where | What |
|---|---|---|
| **0 — Validation** (done) | Eitherway | Prompt-generate v0, export to local, confirm export path |
| **1 — Extend** (days 2–15) | `~/local-dev/kami/` | Fastify backend, Kamino SDK tools, production polish, testing |
| **2 — Deploy** (days 16–20) | Eitherway / Vercel | Upload back to Eitherway for final URL + optional custom domain |
| **3 — GTM** (days 21–23) | Twitter, Superteam | Demo video, launch thread, community posts |
| **4 — Adoption** (days 24–30+) | post-submission | Real users, onchain activity, bug fixes, judging window |

Rule compliance:
- ✅ v0 was built with Eitherway (documented via screenshots + `eitherway-v0` git tag)
- ✅ Deploy URL will come from Eitherway ("deployment platform" per rules)
- ✅ Custom code is explicitly allowed per Eitherway FAQ: *"Yes. Eitherway is the deployment platform, but you can extend functionality with custom integrations."*

## Core features

Must-have (ships for submission) — **all live on mainnet as of Day 8**:
- Streaming chat with Claude Sonnet 4.6 via OpenRouter on a Node-style Vercel Function (Fastify in local dev only)
- Solflare-featured wallet connect via Wallet Standard discovery (any Wallet-Standard-compatible wallet — Phantom, Backpack, etc. — also works)
- `getPortfolio` tool → user's Kamino obligation (deposits, borrows, health) ✓
- `findYield` tool → ranks Kamino reserves by APY vs risk ✓
- `simulateHealth` tool → projects health factor for hypothetical actions ✓
- `buildDeposit` / `buildBorrow` / `buildWithdraw` / `buildRepay` → unsigned base64 v0 txs for the user's wallet to sign ✓
- Sign & Send card pattern: every `build*` tool result renders a card with action / amount / protocol / preflight surplus, then HTTP-polls confirmation

Nice-to-have (post-submission):
- Scope oracle price overlay
- Chat history sync across devices (Supabase)
- Push alerts on liquidation risk (Dialect)
- Multi-market support (not just main market)

## Non-negotiables

- **No custody**: Kami never holds keys or funds. All writes require explicit user sign.
- **No private-key prompts**: the assistant never asks for a seed, key, or signature payload in chat.
- **Hallucination guardrails**: price/APY responses always disclaim approximation; tool outputs are authoritative.
- **Production tone**: every write transaction card ends with a "Verify every detail before signing." footer.
- **Branch discipline**: one commit per logical change, no AI attribution in messages.

## Stack commitments (state at Day 8)

- Frontend: Vite + React 18 (Eitherway's choice — accepted for velocity); top-level `ErrorBoundary` at root
- Backend: Vercel AI SDK v6 (`streamText` + `fullStream`) on Node-style Vercel Functions (`api/chat.ts` + `api/rpc.ts`). Fastify 5 retained for local dev only (`server/index.ts`)
- LLM: `anthropic/claude-sonnet-4.6` via OpenRouter (swappable via `KAMI_MODEL`)
- Solana: `@kamino-finance/klend-sdk` 7.3 on `@solana/kit` v2; `createNoopSigner` + `compileTransaction` so the wallet signs client-side and the server holds no key
- Deploy: Vercel auto-deploys from `main`; `eitherway-v0` git tag preserves the Eitherway-genesis origin; custom domain `kami.rectorspace.com` via Cloudflare DNS-only + Vercel auto-SSL
- Rate-limit: `@upstash/ratelimit` against self-hosted Redis at `redis-kami.rectorspace.com` (Cloudflare tunnel + `hiett/serverless-redis-http` shim); fail-open on Upstash error
- Tests: `pnpm test:run` — 106 vitest tests across handlers, guards, ratelimit, helpers, components; CI runs typecheck + tests + build + klend-sdk pin guard on every push
- Lint/format: follow repo defaults; no bespoke config (deferred — not blocking submission)

## Credit budget

- Starter ($7) consumed on 2026-04-19 — produced v0 scaffold
- Builder ($20, +$13) reserved for day-2 top-up if needed
- Prompt economics: ~4 credits per Q&A, ~50 credits per full build
- Strategy: minimize Eitherway prompts; maximize local Cipher development

## Risks

| Risk | Mitigation |
|---|---|
| Eitherway disqualifies local-heavy submissions | FAQ explicitly allows "custom integrations"; document the Eitherway-origin v0 |
| klend-sdk v2 migration friction | Schedule day 2 morning for the migration; fallback: hand-write the minimum SDK calls |
| Custom domain doesn't map cleanly | Fall back to Eitherway subdomain; no submission risk |
| Credit overruns | Upgrade to Builder mid-sprint; local-primary development limits Eitherway usage |
