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

| Phase | Where | What | Status |
|---|---|---|---|
| **0 — Validation** | Eitherway | Prompt-generate v0, export to local, confirm export path | ✅ Day 1 |
| **1 — Extend** (Days 2–7) | `~/local-dev/kami/` | Vercel AI SDK + Kamino SDK tools, mainnet validation, production polish, security hardening | ✅ Day 7 |
| **2 — Tech-debt sweep** (Day 8) | Local | Adversarial review, handler integration tests, ErrorBoundary, doc consistency, infra hygiene (kami SSH, SRH_TOKEN rotation) | ✅ Day 8 |
| **3 — GTM** (Days 9–23) | Twitter, Superteam | Telegram compliance ping, README screenshots, demo video, launch thread, submission form, judging rehearsal | ⏳ pending |
| **4 — Adoption** (post-submission) | — | Real users, onchain activity, bug fixes, judging window | ⏳ post-2026-05-12 |

Day numbers reflect actual execution (build started 2026-04-19, submission deadline 2026-05-12 = Day 23). The original plan budgeted Days 16–20 for deployment; production was actually live on mainnet by Day 4 via direct Vercel deploy, and the freed buffer funded the Day 8 tech-debt sweep.

Rule compliance:
- ✅ v0 was built with Eitherway (documented via screenshots + `eitherway-v0` git tag)
- ✅ Deployed via Vercel — explicitly supported by Eitherway's FAQ ("Eitherway is the deployment platform, but you can extend functionality with custom integrations") and confirmed by the Day 7 review of the Superteam bounty listing
- ✅ Live URL: [`kami.rectorspace.com`](https://kami.rectorspace.com) (custom domain, Cloudflare DNS-only → Vercel auto-SSL)
- ✅ Integration documentation shipped as `docs/kamino-integration.md` (bounty deliverable)

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

## Credit budget (Eitherway)

- Starter ($7) consumed on 2026-04-19 — produced v0 scaffold; Builder upgrade never needed
- Local-primary strategy held: Eitherway prompts limited to the genesis scaffold; all subsequent development happened in `~/local-dev/kami/`

## Risks (state at Day 8)

| Risk | Mitigation | Status |
|---|---|---|
| Eitherway disqualifies local-heavy submissions | FAQ explicitly allows "custom integrations"; Eitherway-origin v0 preserved via `eitherway-v0` git tag; Vercel is Eitherway's documented deploy target | ✅ resolved (Day 7 bounty re-read) |
| klend-sdk v2 migration friction | Day 2 morning slot; fallback: hand-write minimum SDK calls | ✅ resolved (klend-sdk 7.3 on @solana/kit v2 integrated cleanly) |
| Custom domain doesn't map cleanly | Fall back to Eitherway subdomain | ✅ resolved (`kami.rectorspace.com` live via Cloudflare + Vercel auto-SSL) |
| Credit overruns | Upgrade to Builder mid-sprint | ✅ resolved (Starter never exhausted; local-primary held) |
| Demo-day live regression on the fresh-wallet first-deposit preflight path | Re-test before recording (parked as A5 — needs fresh keypair + Solflare hand) | ⏳ low risk; preflight logic unchanged since Day 6 mainnet validation, only error-message text edited Day 7 |
| Vercel-side rate-limit outage on Redis backend | `applyLimit` fails open per `server/ratelimit.ts:85-90` — Kami serves without enforcement rather than 500-ing; 15-min GitHub Actions PING heartbeat catches outages | ✅ mitigated (Phase B4) |
| `klend-sdk` major bump silently breaking the kit-v2 peer-dep silencing | CI workflow step parses `package.json`'s klend-sdk pin and fails on any major beyond ^7.x | ✅ mitigated (Phase B3) |
| Kamino's `NetValueRemainingTooSmall` dust floor breaking close-out flows | LLM auto-recovery: dust-floor error → `getPortfolio` refresh → `buildRepay` with buffer; validated mainnet 2026-04-24 | ✅ resolved |
| Kamino obligation rent (~0.022 SOL) framed as refundable in user-facing surfaces | Day 7 IDL scan + Kamino UI test confirmed permanent lock; preflight error messages + integration docs + LLM system prompt corrected | ✅ resolved (Day 7–8) |
