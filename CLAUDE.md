# CLAUDE.md — Kami

Project-level instructions for Claude (CIPHER) when working in this repo.
Global rules live in `~/.claude/CLAUDE.md`; this file captures what is
specific to Kami.

## What Kami is

Kami is a conversation-driven AI co-pilot for [Kamino Finance](https://kamino.finance/)
on Solana. The user types in plain English (*"best USDC yield"*, *"will this
borrow liquidate me?"*, *"deposit 5 USDC"*), an LLM orchestrates real
`@kamino-finance/klend-sdk` calls, and — when the request is actionable —
returns a ready-to-sign mainnet transaction.

- **Live:** https://kami.rectorspace.com (Vercel auto-deploys from `main`)
- **Bounty:** Eitherway Track — Frontier Hackathon 2026 (Kamino prize)
- **Submission deadline:** 2026-05-12
- **Repo:** RECTOR-LABS/kami (public, MIT licensed, mirrored to GitLab)
- **Strategy doc:** `STRATEGY.md`
- **Bounty deliverable:** `docs/kamino-integration.md`

## Stack

| Layer | What | Where |
|------|------|-------|
| Frontend | Vite + React 18 + TypeScript + Tailwind | `src/` |
| Wallets | `@solana/wallet-adapter-react` (Solflare featured, Wallet-Standard fallback) | `src/components/WalletProvider.tsx` |
| Chat backend (one source of truth) | Vercel AI SDK v6 `streamText` + `fullStream` | `server/chat.ts` |
| Chat handler | Node-style Vercel Function (prod) + Fastify (local dev) | `api/chat.ts` + `server/index.ts` |
| RPC proxy | Same-origin Vercel Function → Helius | `api/rpc.ts` |
| LLM | `anthropic/claude-sonnet-4.6` via OpenRouter | (env var `KAMI_MODEL`) |
| DeFi | `@kamino-finance/klend-sdk` 7.3 on `@solana/kit` v2 | `server/tools/kamino.ts` |
| Tx build | `createNoopSigner` + `compileTransaction` + `getBase64EncodedWireTransaction` | `server/tools/kamino.ts:642-675` |
| Confirmation | HTTP polling (`getSignatureStatuses` + `getBlockHeight`) | `src/components/chat/TxStatusCard.tsx` |
| Rate limit | `@upstash/ratelimit` against VPS-hosted Redis (Upstash REST shim) | `server/ratelimit.ts` |

## Production state

- **Domain:** kami.rectorspace.com (Cloudflare DNS-only → Vercel auto-SSL)
- **Vercel project:** rectors-projects/kami
- **Env vars (production):**
  - `KAMI_OPENROUTER_API_KEY` — LLM
  - `KAMI_MODEL` — overrides the default model
  - `SOLANA_RPC_URL` — Helius mainnet endpoint
  - `UPSTASH_REDIS_REST_URL` = `https://redis-kami.rectorspace.com`
  - `UPSTASH_REDIS_REST_TOKEN` — see `~/Documents/secret/claude-strategy/kami/vps-redis-details.md`
- **Rate limits enforced:** 30/min on `/api/chat`, 120/min on `/api/rpc`
- **Security headers:** CSP, HSTS (2y, preload), X-CTO=nosniff, X-Frame-Options=DENY,
  Referrer-Policy=strict-origin-when-cross-origin, Permissions-Policy, COOP — all in `vercel.json`
- **CI workflows:** `test.yml` (typecheck + tests + build + klend-sdk pin guard),
  `mirror-gitlab.yml` (force-push to GitLab), `uptime-redis.yml` (15-min PING heartbeat)

## VPS infrastructure (reclabs3)

Self-hosted Redis + Upstash REST shim backs the rate-limit. Full ops playbook:
`~/Documents/secret/claude-strategy/kami/vps-redis-details.md` (iCloud-encrypted).

- VPS user: `kami` (uid 1009, docker group). SSH alias: `ssh kami`.
- Stack path: `/home/kami/redis/` — `docker-compose name: kami-redis`.
- Cloudflare tunnel ingress: `redis-kami.rectorspace.com → http://localhost:6382`.
- Trade-off accepted: iad1→ams adds ~100-120 ms per API call.
- Failure mode: SRH/Redis outage → `applyLimit` fails open (returns null) →
  Kami serves without rate-limit enforcement rather than 500-ing. See
  `server/ratelimit.ts:85-90`.

## Conventions

- **One commit per logical change.** Never batch multiple improvements.
- **No AI attribution** in commit messages, PR bodies, or docs (per global CLAUDE.md).
- **Tests are mandatory** for every new function / hook / component / handler. CI enforces.
- **Production-quality bar:** "Would this survive a security audit? Would I deploy to mainnet tonight?"
- **Vitest glob:** `src/**/*.{test,spec}.{ts,tsx}` + `server/**/*.{test,spec}.ts` + `api/**/*.{test,spec}.ts`.
- **Server-side handler tests** use a `Readable.fromWeb` shim from `src/test-setup.ts` because
  vite's `nodePolyfills` plugin replaces `node:stream` with `readable-stream` (which lacks `fromWeb`).

## Commands

```bash
# Dev
pnpm dev                                              # web :5173 + api :3001 concurrently

# Typecheck / build
pnpm exec tsc --noEmit                                # client
pnpm exec tsc -p server/tsconfig.json --noEmit        # server + api/*.ts
pnpm exec tsc -b                                      # both, project mode (matches Vercel)
pnpm build                                            # tsc -b + vite build

# Tests
pnpm test:run                                         # 186 vitest tests across 21 files
pnpm test:coverage                                    # with v8 coverage report

# Production smoke
curl -sS -X POST https://kami.rectorspace.com/api/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' -D -   # expect X-RateLimit-Limit: 120
curl -sI https://kami.rectorspace.com | grep -iE 'csp|strict|frame|coop'

# VPS health
ssh kami 'cd /home/kami/redis && docker compose ps'
ssh kami 'cd /home/kami/redis && docker compose logs --tail=50 redis-http'

# Rotate SRH_TOKEN (90-day cadence — see vps-redis-details.md)
./scripts/rotate-srh-token.sh
```

## Stack gotchas (cumulative through Day 17)

- **Vercel `api/*.ts` MUST be Node-style** `(req: IncomingMessage, res: ServerResponse)`.
  Web-fetch style silently hangs with `FUNCTION_INVOCATION_TIMEOUT`. Pipe Web streams via
  `Readable.fromWeb`. Function timeouts: `api/chat.ts` = 60s, `api/rpc.ts` = 30s.
- **klend-sdk 7.3 uses `@solana/kit` v2.** `KaminoAction.build*Txns` takes a `TransactionSigner` —
  use `createNoopSigner(address)` because the wallet signs client-side. Then compile with
  `compileTransaction` (NOT `signTransactionMessageWithSigners`, which errors "missing
  signatures" on noop).
- **`getUserVanillaObligation` THROWS on empty obligations.** Use
  `market.getObligationByAddress(VanillaObligation.toPda(...))` → returns `null` cleanly.
- **AI SDK v6 + zod v4:** each `tool({ inputSchema, execute })` must be a literal concrete
  schema; a generic `wrap<I,O>` helper collapses to `Tool<never,never>`.
- **`fullStream` (not `textStream`)** is required for tool-call/tool-result/tool-error events
  to surface.
- **`wsEndpoint: ''`** on the Connection config + HTTP polling loop. Do NOT call
  `connection.confirmTransaction` — it tries to open a WS subscription Vercel can't upgrade
  and will hang. See `pollSignatureStatus` in `src/components/chat/TxStatusCard.tsx`.
- **Modern Solflare registers via Wallet Standard.** `wallets=[]` + Wallet Standard
  discovery is the path now. Explicit `SolflareWalletAdapter` is redundant and logs a warning.
- **Kamino obligation rent (~0.022 SOL)** is permanently locked per (user, market) pair —
  klend has no `close_obligation` instruction (verified empirically Day 7 via IDL scan +
  Kamino UI test + on-chain balance comparison). Error messaging must NOT promise refund.
  See `~/.claude/projects/-Users-rector-local-dev-kami/memory/kamino-first-time-deposit-rent.md`.
- **Kamino `NetValueRemainingTooSmall` floor (~$1-$5).** Any action dropping the obligation
  below reverts (Anchor error 0x17cc). The LLM auto-recovers in `buildRepay` —
  `getPortfolio` → `buildRepay` (fails dust floor) → `buildRepay` with buffer (succeeds).
- **`react-markdown` v10:** when overriding both `pre` and `code`, the `pre` element's
  children receive the user-overridden code component as the child element's `type`,
  not the string `'code'`. Read `className` off `children[0].props` directly;
  `React.isValidElement + c.type === 'code'` fails silently.
- **Rate-limit fail-open:** if Upstash/SRH throws, `applyLimit` logs to stderr + returns null.
  App continues serving without enforcement rather than 500. Verify via `journalctl -u
  cloudflared` on reclabs3 + Vercel function logs if `X-RateLimit-*` headers stop appearing.
- **`docker compose restart`** on reclabs3 momentarily drops in-flight rate-limit checks;
  they fail open, no 500s. ~2s window.
- **Cloudflared self-disconnect:** restarting cloudflared on reclabs3 kicks an SSH session
  that was tunneling through it. Reconnect and proceed.
- **`pnpm exec tsc -b` skips `server/tsconfig.json`.** Root `tsconfig.json` has no project
  references, so `tsc -b` only validates client. Always run all 3 typecheck commands locally
  before pushing server-side changes (memory `tsc-b-skips-server-tsconfig.md`). The Day 11
  oracle-staleness CI failure (`@types/bn.js` missing) escaped local checks because of this.
- **`Array.prototype.at()` is ES2022.** Root `tsconfig.json` `lib` targets ES2020; `.at()`
  fails client typecheck on `src/*`. Use `arr[arr.length - 1]` for last-element access in
  `src/`. Server tsconfig targets ES2022 — trap is client-only (memory
  `array-at-es2020-trap.md`).
- **Vitest shared mock state via `vi.hoisted()`.** For mocks that need to share state with
  test bodies, prefer `vi.hoisted()` over bare `const` — works under Vitest 4.x auto-detect
  but fragile across refactors (memory `vitest-vi-hoisted-convention.md`).

## Phase progress (state at end of Day 17)

- **Phase 1 — Extend (Days 2-5):** ✓ Complete. All 7 Kamino tools live-validated mainnet.
- **Phase 2 — Production hardening (Days 6-7):** ✓ Complete. Security review, rate-limit live,
  integration docs.
- **Phase A/B/C — Pre-submission rigor (Day 8):** ✓ Complete. TODO/FIXME scan clean,
  ErrorBoundary at root, klend-sdk pin guard CI, redis-kami uptime heartbeat, SRH_TOKEN
  90-day rotation script, kami-user SSH key on reclabs3 (replaces root-only ops). Tests
  60 → 106 across 10 files.
- **QA backlog cleanup (Days 9-16):** ✓ Complete. Umbrella [#3](https://github.com/RECTOR-LABS/kami/issues/3)
  closed — 27 child issues across 10 PRs. Tests 106 → 186 across 21 files. Sprint sequence:
  C-1 wallet-not-connected UX (PR [#2](https://github.com/RECTOR-LABS/kami/pull/2));
  C-3 error visibility (PR [#31](https://github.com/RECTOR-LABS/kami/pull/31));
  D-12 abort-signal propagation (PR [#32](https://github.com/RECTOR-LABS/kami/pull/32));
  D-13 oracle-staleness gate (PRs [#33](https://github.com/RECTOR-LABS/kami/pull/33), [#34](https://github.com/RECTOR-LABS/kami/pull/34));
  C-2 streaming polish (PR [#35](https://github.com/RECTOR-LABS/kami/pull/35));
  C-3-finish yield-table polish (PR [#36](https://github.com/RECTOR-LABS/kami/pull/36));
  P3 trivial sweep (PR [#37](https://github.com/RECTOR-LABS/kami/pull/37));
  P2 server hygiene (PR [#38](https://github.com/RECTOR-LABS/kami/pull/38));
  P2 UI features (PR [#40](https://github.com/RECTOR-LABS/kami/pull/40));
  P1 cluster (PR [#41](https://github.com/RECTOR-LABS/kami/pull/41)).
- **Day 17 — Bounty submission prep:** ✓ Showcase README rewrite (PR [#42](https://github.com/RECTOR-LABS/kami/pull/42)),
  MIT LICENSE (PR [#43](https://github.com/RECTOR-LABS/kami/pull/43)), demo-script Sprint 4.x sync
  (PR [#44](https://github.com/RECTOR-LABS/kami/pull/44)), post-bounty backlog filed
  ([#45](https://github.com/RECTOR-LABS/kami/issues/45) + [#46](https://github.com/RECTOR-LABS/kami/issues/46)).
- **Phase D — GTM (Days 17-25):** Pending. Empty-state screenshots, demo video recording
  (~2:30-2:50), tweet thread posting, Telegram compliance ping (Eitherway / Kamino sponsor
  channels), Superteam submission, judging rehearsal — RECTOR-driven.
- **A5 — Fresh-wallet first-deposit retest:** Parked. Needs fresh keypair + Solflare
  signing. Low risk per `c17e4b3` diff (text-only since last verification on Day 6).

## Known limits / accepted trade-offs

- **iad1→ams latency:** ~100-120 ms per API call due to VPS-Redis location.
  Mitigation: rate-limit fails open on Redis outage, so latency adds cost but not failure.
- **616 kB Vite main bundle warning:** non-blocking. Day-6 markdown code-split saved 48 kB;
  further splitting deferred (cosmetic Lighthouse improvement only).
- **No `closeObligation` tool:** technically impossible until Kamino ships the instruction
  upstream. ~0.022 SOL stays locked per (user, market) pair. Documented in
  `docs/kamino-integration.md#known-limits` + the LLM system prompt.
- **No log drain configured:** deliberate. Vercel dashboard sufficient for hackathon scope.
- **Test coverage:** 186 vitest tests across 21 files. Day 5-17 production-critical surfaces
  (handlers, guards, ratelimit, walletError, ErrorBoundary, kamino helpers, `log.ts`,
  abort-signal propagation, oracle-staleness gate, ChatPanel, Sidebar, EmptyState,
  ToolCallBadges, markdown-renderer, useChat streaming) are all ≥ 80% covered. SDK
  orchestration in `server/tools/kamino.ts` validated via Day-6 mainnet round-trip rather
  than unit tests.
- **Open post-bounty backlog:** [#39](https://github.com/RECTOR-LABS/kami/issues/39) (D-26
  empty-msg-on-abort cosmetic UX), [#45](https://github.com/RECTOR-LABS/kami/issues/45)
  (D-27 useChat `[DONE]` SSE chunk inner-for-break — Sprint 4.3 reviewer "no code change
  required to ship"), [#46](https://github.com/RECTOR-LABS/kami/issues/46) (umbrella for 13
  deferred Sprint 4.x cluster minors). All P2/P3, NOT bounty-blocking.

## File map (key locations)

```
LICENSE                   # MIT — added Day 17 (PR #43)
api/
  chat.ts                 # streaming LLM endpoint (zod-validated, rate-limited)
  rpc.ts                  # JSON-RPC proxy (allowlist + batch caps + rate-limited)
  *.test.ts               # handler integration tests
server/
  chat.ts                 # createChatStream — single source of truth for tool wiring
  prompt.ts               # LLM system prompt (Kamino domain, safety rules, rent guidance)
  ratelimit.ts            # Upstash glue + identify() + applyLimit()
  rpc-guards.ts           # disallowedMethodIn + oversizedParamsIn helpers (renamed Day 16)
  log.ts                  # structured JSON logger (added Day 14, reserved-field anti-injection)
  tools/kamino.ts         # 7 Kamino tools + preflightSimulate + helpers (toNumber, formatSol,
                          #                                            computeHealthFactor, ...)
  solana/connection.ts    # RPC client setup (URL-aware singleton, Day 14)
  index.ts                # Fastify dev server (NOT used in prod)
src/
  components/
    ErrorBoundary.tsx       # top-level React error catch (Day 8)
    chat/TxStatusCard.tsx   # wallet-sign flow + HTTP polling (Day 20 chat-shell amber)
    WalletProvider.tsx      # Solana wallet adapter wiring (Wallet Standard discovery)
    ChatPanel.tsx, ChatInput.tsx, ChatMessage.tsx, EmptyState.tsx, Sidebar.tsx,
    ToolCallBadges.tsx      # tool-call event badges with dedup + ×N suffix (Day 12)
  hooks/useChat.ts          # conversation state + streaming hook
  lib/markdown-renderer.tsx # react-markdown + remark-gfm wiring + risk chip renderer (Day 12)
  lib/walletError.ts        # wallet error classifier
docs/
  kamino-integration.md     # bounty deliverable: tool-by-tool SDK mapping
  demo-script.md            # 2:30-2:50 shot list + VO (Sprint 4.x synced Day 17)
  tweet-thread.md           # 5-tweet launch draft
  superpowers/specs/        # sprint design docs (one per cluster)
  superpowers/plans/        # sprint implementation plans (one per cluster)
assets/
  architecture.svg          # dark-mode end-to-end data flow diagram
  screenshots/              # placeholder dir — populated by RECTOR via CleanShot X
scripts/
  rotate-srh-token.sh       # 90-day SRH_TOKEN rotation (Phase C2)
.github/workflows/
  test.yml                  # CI: typecheck + 186 tests + build + klend-sdk pin guard
  mirror-gitlab.yml         # force-push main → GitLab
  uptime-redis.yml          # 15-min PING heartbeat for redis-kami
```

## When in doubt

- For Kamino SDK behavior, consult `docs/kamino-integration.md` first.
- For VPS / Redis ops, consult `~/Documents/secret/claude-strategy/kami/vps-redis-details.md`.
- For session continuity, the latest handoff is in
  `~/Documents/secret/claude-strategy/kami/session-handoff-*.md`.
- For Kamino edge cases that bit us before, check
  `~/.claude/projects/-Users-rector-local-dev-kami/memory/MEMORY.md`.
