<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# Kami

> Conversation-driven AI co-pilot for [Kamino Finance](https://kamino.finance/) on Solana. The user types in plain English (*"best USDC yield"*, *"will this borrow liquidate me?"*, *"deposit 5 USDC"*), an LLM orchestrates real `@kamino-finance/klend-sdk` calls, and — when actionable — returns a ready-to-sign mainnet transaction.

**Live:** https://kami.rectorspace.com (Vercel auto-deploys from `main`)
**Bounty:** Eitherway Track — Frontier Hackathon 2026 (Kamino prize), submission deadline 2026-05-12
**Repo:** RECTOR-LABS/kami (public, MIT, mirrored to GitLab) · **Strategy:** `STRATEGY.md` · **Bounty deliverable:** `docs/kamino-integration.md`

## Stack

| Layer | What | Where |
|------|------|-------|
| Frontend | Vite + React 18 + TypeScript + Tailwind | `src/` |
| Wallets | `@solana/wallet-adapter-react` (Solflare featured, Wallet-Standard fallback) | `src/components/WalletProvider.tsx` |
| Chat backend (one source of truth) | Vercel AI SDK v6 `streamText` + `fullStream` | `server/chat.ts` |
| Chat handler | Node-style Vercel Function (prod) + Fastify (local dev) | `api/chat.ts` + `server/index.ts` |
| RPC proxy | Same-origin Vercel Function → Helius | `api/rpc.ts` |
| LLM | `anthropic/claude-sonnet-4.6` via OpenRouter | env `KAMI_MODEL` |
| DeFi | `@kamino-finance/klend-sdk` 7.3 on `@solana/kit` v2 | `server/tools/kamino.ts` |
| Tx build | `createNoopSigner` + `compileTransaction` + `getBase64EncodedWireTransaction` | `server/tools/kamino.ts:642-675` |
| Confirmation | HTTP polling (`getSignatureStatuses` + `getBlockHeight`) | `src/components/chat/TxStatusCard.tsx` |
| Rate limit | `@upstash/ratelimit` against VPS-hosted Redis (Upstash REST shim) | `server/ratelimit.ts` |

## Production State

- **Domain:** kami.rectorspace.com (Cloudflare DNS-only → Vercel auto-SSL) · **Vercel project:** rectors-projects/kami
- **Env vars (production):** `KAMI_OPENROUTER_API_KEY` (LLM) · `KAMI_MODEL` · `SOLANA_RPC_URL` (Helius mainnet) · `UPSTASH_REDIS_REST_URL` (`https://redis-kami.rectorspace.com`) · `UPSTASH_REDIS_REST_TOKEN` (see `~/Documents/secret/strategy/kami/vps-redis-details.md`)
- **Rate limits:** 30/min on `/api/chat`, 120/min on `/api/rpc`
- **Security headers:** CSP, HSTS (2y preload), X-CTO=nosniff, X-Frame-Options=DENY, Referrer-Policy, Permissions-Policy, COOP — all in `vercel.json`
- **CI:** `test.yml` (typecheck + tests + build + klend-sdk pin guard), `mirror-gitlab.yml`, `uptime-redis.yml` (15-min PING heartbeat)

## VPS Infrastructure (reclabs3)

Self-hosted Redis + Upstash REST shim backs the rate-limit. Ops playbook: `~/Documents/secret/strategy/kami/vps-redis-details.md`.

- VPS user `kami` (uid 1009, docker group). SSH alias `ssh kami`.
- Stack path `/home/kami/redis/` — `docker-compose name: kami-redis`.
- Cloudflare tunnel ingress: `redis-kami.rectorspace.com → http://localhost:6382`.
- Trade-off: iad1→ams ~100-120 ms per API call.
- **Failure mode:** SRH/Redis outage → `applyLimit` fails open (returns null) → Kami serves without rate-limit enforcement rather than 500-ing. See `server/ratelimit.ts:85-90`.

## Common Commands

```bash
pnpm dev                                              # web :5173 + api :3001 concurrently
pnpm exec tsc --noEmit                                # client typecheck
pnpm exec tsc -p server/tsconfig.json --noEmit        # server + api typecheck
pnpm exec tsc -b                                      # both, project mode (matches Vercel)
pnpm build                                            # tsc -b + vite build
pnpm test:run                                         # 186 vitest tests across 21 files
pnpm test:coverage                                    # v8 coverage

# Production smoke
curl -sS -X POST https://kami.rectorspace.com/api/rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' -D -   # expect X-RateLimit-Limit: 120
curl -sI https://kami.rectorspace.com | grep -iE 'csp|strict|frame|coop'

# VPS health
ssh kami 'cd /home/kami/redis && docker compose ps'
ssh kami 'cd /home/kami/redis && docker compose logs --tail=50 redis-http'

# Rotate SRH_TOKEN (90-day cadence)
./scripts/rotate-srh-token.sh
```

## Stack Gotchas (cumulative)

- **Vercel `api/*.ts` MUST be Node-style** `(req, res)`. Web-fetch style silently hangs with `FUNCTION_INVOCATION_TIMEOUT`. Pipe Web streams via `Readable.fromWeb`. Timeouts: `api/chat.ts` 60s, `api/rpc.ts` 30s.
- **klend-sdk 7.3 uses `@solana/kit` v2.** `KaminoAction.build*Txns` takes a `TransactionSigner` — use `createNoopSigner(address)` (wallet signs client-side). Compile with `compileTransaction` (NOT `signTransactionMessageWithSigners` — errors "missing signatures" on noop).
- **`getUserVanillaObligation` THROWS on empty obligations.** Use `market.getObligationByAddress(VanillaObligation.toPda(...))` → returns `null` cleanly.
- **AI SDK v6 + zod v4:** each `tool({ inputSchema, execute })` must be a literal concrete schema; a generic `wrap<I,O>` helper collapses to `Tool<never,never>`.
- **`fullStream` (not `textStream`)** required for tool-call/tool-result/tool-error events to surface.
- **`wsEndpoint: ''`** on Connection + HTTP polling loop. Do NOT call `connection.confirmTransaction` — it opens a WS subscription Vercel can't upgrade and hangs. See `pollSignatureStatus` in `TxStatusCard.tsx`.
- **Modern Solflare registers via Wallet Standard.** `wallets=[]` + Wallet Standard discovery is the path. Explicit `SolflareWalletAdapter` is redundant + logs a warning.
- **Kamino obligation rent (~0.022 SOL)** permanently locked per (user, market) pair — klend has no `close_obligation` instruction. Error messaging must NOT promise refund.
- **Kamino `NetValueRemainingTooSmall` floor ~$5 USD net** (not documented ~$1). Positions with $4-6 net cannot close cleanly via standard repay/withdraw. The Kamino UI "Repay Max" uses an atomic close-out path that bypasses this. Preflight detects `0x17cc` / `NetValueRemainingTooSmall`, returns structured `errorCode: 'dust-floor'` + `suggestedAlternatives`; LLM routes to recovery (add-collateral / partial-repay / kamino-ui-escape).
- **`react-markdown` v10:** when overriding both `pre` and `code`, the `pre` element's children receive the user-overridden code component as `type`, not string `'code'`. Read `className` off `children[0].props` directly.
- **Rate-limit fail-open:** if Upstash/SRH throws, `applyLimit` logs to stderr + returns null. App continues serving without enforcement rather than 500.
- **`pnpm exec tsc -b` skips `server/tsconfig.json`** (root tsconfig has no project references). Always run all 3 typecheck commands before pushing server-side changes.
- **`Array.prototype.at()` is ES2022.** Root `tsconfig.json` `lib` targets ES2020; `.at()` fails client typecheck on `src/*`. Use `arr[arr.length - 1]`.
- **Vitest shared mock state via `vi.hoisted()`** over bare `const` (works under Vitest 4.x auto-detect but fragile).
- **Solflare's `signAndSendTransaction` bypasses our `/api/rpc`** — signs AND broadcasts inside the extension via `chrome.runtime.sendMessage` using Solflare's own RPC. `TxStatusCard` uses `useWallet().signTransaction(tx)` + manual `connection.sendRawTransaction(...)` so broadcast goes through our Helius proxy with structured errors.

## Phase Progress

- **Phase 1 — Extend (Days 2-5):** ✓ all 7 Kamino tools live-validated mainnet
- **Phase 2 — Production hardening (Days 6-7):** ✓ security review, rate-limit live, integration docs
- **Phase A/B/C — Pre-submission rigor (Day 8):** ✓ TODO/FIXME scan clean, ErrorBoundary, klend-sdk pin guard CI, redis-kami uptime heartbeat, SRH_TOKEN rotation script, kami-user SSH key. Tests 60 → 106.
- **QA backlog cleanup (Days 9-16):** ✓ umbrella #3 closed — 27 child issues across 10 PRs. Tests 106 → 186 across 21 files.
- **Day 17 — Bounty submission prep:** ✓ showcase README, MIT LICENSE, demo-script sync, post-bounty backlog filed.
- **Phase D — GTM (Days 17-25):** Pending (RECTOR-driven): empty-state screenshots, demo video (~2:30-2:50), tweet thread, Telegram compliance ping, Superteam submission, judging rehearsal.

## Known Limits / Trade-offs

- iad1→ams latency ~100-120 ms per API call (rate-limit fails open on outage)
- 616 kB Vite main bundle warning (non-blocking; cosmetic Lighthouse only)
- No `closeObligation` tool (impossible until Kamino ships it upstream; ~0.022 SOL locked per pair)
- No log drain configured (deliberate — Vercel dashboard sufficient for hackathon scope)
- 186 vitest tests across 21 files; production-critical surfaces ≥ 80% covered. SDK orchestration validated via Day-6 mainnet round-trip.
- Open post-bounty backlog: #39, #45, #46 — all P2/P3, NOT bounty-blocking.

## File Map

```
api/{chat,rpc}.ts + *.test.ts        # streaming LLM endpoint + JSON-RPC proxy + handler tests
server/
  chat.ts           # createChatStream — single source of truth for tool wiring
  prompt.ts         # LLM system prompt (Kamino domain, safety, rent guidance)
  ratelimit.ts      # Upstash glue + identify() + applyLimit()
  rpc-guards.ts     # disallowedMethodIn + oversizedParamsIn
  log.ts            # structured JSON logger (reserved-field anti-injection)
  tools/kamino.ts   # 7 Kamino tools + preflightSimulate + helpers
  solana/connection.ts
  index.ts          # Fastify dev server (NOT used in prod)
src/components/{ErrorBoundary,chat/TxStatusCard,WalletProvider,ChatPanel,ChatInput,ChatMessage,EmptyState,Sidebar,ToolCallBadges}.tsx
src/hooks/useChat.ts · src/lib/{markdown-renderer,walletError}.tsx
docs/{kamino-integration,demo-script,tweet-thread}.md · docs/superpowers/{specs,plans}/
assets/{architecture.svg, screenshots/}
scripts/rotate-srh-token.sh
.github/workflows/{test,mirror-gitlab,uptime-redis}.yml
```

## When in doubt

- Kamino SDK behavior → `docs/kamino-integration.md` first
- VPS / Redis ops → `~/Documents/secret/strategy/kami/vps-redis-details.md`
- Session continuity → `~/Documents/secret/strategy/kami/session-handoff-*.md`
- Kamino edge cases → `~/.claude/projects/-Users-rector-local-dev-kami/memory/MEMORY.md`