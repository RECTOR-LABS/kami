<div align="center">

<pre>
██╗  ██╗  █████╗  ███╗   ███╗ ██╗
██║ ██╔╝ ██╔══██╗ ████╗ ████║ ██║
█████╔╝  ███████║ ██╔████╔██║ ██║
██╔═██╗  ██╔══██║ ██║╚██╔╝██║ ██║
██║  ██╗ ██║  ██║ ██║ ╚═╝ ██║ ██║
╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝     ╚═╝ ╚═╝
</pre>

# Kami — AI Co-Pilot for Kamino DeFi on Solana

**🤖 Type plain English. Get a signed mainnet transaction. Every time.**
*Seven Kamino tools · Real APYs · Health-factor projection · LLM auto-recovery · Preflight simulation · Sign & Send · Live mainnet*

[![CI](https://github.com/RECTOR-LABS/kami/actions/workflows/test.yml/badge.svg)](https://github.com/RECTOR-LABS/kami/actions/workflows/test.yml)
[![GitLab Mirror](https://github.com/RECTOR-LABS/kami/actions/workflows/mirror-gitlab.yml/badge.svg)](https://github.com/RECTOR-LABS/kami/actions/workflows/mirror-gitlab.yml)
[![Uptime Heartbeat](https://github.com/RECTOR-LABS/kami/actions/workflows/uptime-redis.yml/badge.svg)](https://github.com/RECTOR-LABS/kami/actions/workflows/uptime-redis.yml)
[![Tests](https://img.shields.io/badge/tests-186%20passing-success)](https://github.com/RECTOR-LABS/kami/actions/workflows/test.yml)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Live](https://img.shields.io/badge/live-kami.rectorspace.com-7c3aed?logo=vercel&logoColor=white)](https://kami.rectorspace.com)
[![Bounty](https://img.shields.io/badge/bounty-Eitherway%20Track-orange)](https://superteam.fun/earn/listing/build-a-live-dapp-with-solflare-kamino-dflow-or-quicknode-with-eitherway-app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-v6-000000)](https://sdk.vercel.ai/)
[![klend-sdk](https://img.shields.io/badge/klend--sdk-7.3-7c3aed)](https://github.com/Kamino-Finance/klend-sdk)
[![@solana/kit](https://img.shields.io/badge/%40solana%2Fkit-v2-9945FF)](https://github.com/anza-xyz/kit)

[**🚀 Live Demo**](https://kami.rectorspace.com) · [**📖 Integration Deep-Dive**](docs/kamino-integration.md) · [**🎬 Demo Script**](docs/demo-script.md) · [**🐦 Tweet Thread**](docs/tweet-thread.md)

</div>

---

## 🎬 What is Kami?

Kami is a **conversation-driven Kamino Finance frontend** on Solana. The user types in plain English — *"best USDC yield right now"*, *"will this borrow liquidate me?"*, *"deposit 5 USDC"*, *"repay everything"* — an LLM orchestrates real `@kamino-finance/klend-sdk` calls, and when the request is actionable, returns a ready-to-sign mainnet transaction.

No raw transaction JSON. No protocol jargon. No hand-rolled instructions. Every write tool maps **one-to-one** to a real `KaminoAction.build*Txns` primitive, and every read tool is backed by live on-chain Scope-oracle data.

<p align="center">
  <img src="./assets/architecture.svg" alt="Kami architecture — plain English to signed mainnet tx" width="100%"/>
</p>

---

## ✅ Proof of Life

Deposited live on mainnet through the deployed UI:

- **Tx:** [`5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE`](https://solscan.io/tx/5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE)
- **Action:** 0.5 USDC supplied to Kamino Main Market at ~5.09% APY
- **Flow:** typed *"Deposit 0.5 USDC into Kamino main market"* → LLM called `findYield` + `buildDeposit` → signed in wallet → on-chain confirmed via client-side polling

The full **deposit → repay → withdraw** round-trip (with `NetValueRemainingTooSmall` auto-recovery) was validated on 2026-04-24 — three archived signatures in **[docs/kamino-integration.md → Hero moment](./docs/kamino-integration.md#hero-moment--llm-auto-recovery-from-kaminos-dust-floor)**.

---

## 📚 Table of Contents

- [🎬 What is Kami?](#-what-is-kami)
- [✅ Proof of Life](#-proof-of-life)
- [✨ Features](#-features)
  - [🔍 Read-only tools](#-read-only-tools-no-signing)
  - [✍️ Write actions](#-write-actions-produce-a-signable-transaction)
  - [🛡️ Safety rails](#-safety-rails)
  - [🎨 UX polish](#-ux-polish)
- [🏗️ Architecture](#-architecture)
- [🚀 Quick Start](#-quick-start)
- [🛠️ Tech Stack](#-tech-stack)
- [🧪 Testing & Quality](#-testing--quality)
- [🔒 Security & Production Hardening](#-security--production-hardening)
- [🚢 Deployment](#-deployment)
- [📖 Documentation](#-documentation)
- [🏆 Bounty Context](#-bounty-context)
- [🙏 Acknowledgments](#-acknowledgments)
- [🌱 Origin](#-origin)
- [📜 License](#-license)

---

## ✨ Features

### 🔍 Read-only tools (no signing)

| Tool | What it does | klend-sdk primitive |
|------|--------------|--------------------|
| `getPortfolio` | Connected wallet's live Kamino position: deposits, borrows, APYs, LTV, health factor | `KaminoMarket.getObligationByAddress` |
| `findYield` | Top reserves ranked by live supply / borrow APY, filterable by symbol | `KaminoMarket.reserves` + `Reserve.calculateSupplyAPY` |
| `simulateHealth` | Project the user's health factor after a hypothetical deposit / borrow / withdraw / repay | `KaminoObligation.simulateBorrowAndWithdrawAction` |

### ✍️ Write actions (produce a signable transaction)

| Tool | What it does | klend-sdk primitive |
|------|--------------|--------------------|
| `buildDeposit` | Construct an unsigned `Deposit` transaction with proper account inits | `KaminoAction.buildDepositTxns` |
| `buildBorrow` | Construct an unsigned `Borrow` with health-factor preflight | `KaminoAction.buildBorrowTxns` |
| `buildWithdraw` | Construct an unsigned `Withdraw` (principal + accrued interest) | `KaminoAction.buildWithdrawTxns` |
| `buildRepay` | Construct an unsigned `Repay`; LLM auto-recovers from `NetValueRemainingTooSmall` | `KaminoAction.buildRepayTxns` |

Each `build*` tool produces a **versioned v0 transaction** server-side: fresh blockhash, proper compute budget, all required account initializations for first-time users, then base64-encoded wire bytes returned to the client. The UI renders a **Sign & Send** card; the user signs in their wallet; the client submits and HTTP-polls confirmation until `confirmed` or blockhash expiry.

### 🛡️ Safety rails

- **Preflight simulation** — every `build*` tool runs `simulateTransaction` before returning. If the wallet is short on SOL for account rent, Kami surfaces a precise shortfall *before* the user burns a failed-tx fee.
- **Oracle staleness gate** — borrows and deposits reject if the price feed is more than ~600 slots stale (matches Pyth/Switchboard convention).
- **LLM auto-recovery** — `buildRepay` failure on Kamino's `NetValueRemainingTooSmall` dust floor triggers an automatic `getPortfolio` refresh + retry with a small buffer. No hand-coded retry loop; the system prompt teaches the LLM to reason about the error.
- **Server-side `AbortSignal`** — client cancellation propagates all the way through the streaming pipeline.
- **RPC method allowlist** — the `/api/rpc` proxy passes only 10 explicitly-allowed JSON-RPC methods. Anything else gets a structured 403.
- **Rate-limited** — 30/min on `/api/chat`, 120/min on `/api/rpc`, fail-open on backend outage so a Redis blip never 500s the app.
- **ErrorBoundary at root** — uncaught render errors surface a recovery panel instead of a white screen.

### 🎨 UX polish

- **Clickable empty-state cards** fire representative queries with one click — "*Best USDC yield*", "*Will this liquidate me?*", and two more.
- **Inline waiting dots** (no separate typing-indicator component) for a calmer streaming feel.
- **Hover sidebar** to see full conversation titles via native `title` tooltip (no JS overhead).
- **Hover-pencil rename** on each conversation in the sidebar.
- **Settings menu** with bulk-clear conversations.
- **Yield table risk chips** (`:risk-high:` / `:risk-medium:` / `:risk-low:`) auto-render as colored badges.
- **Wallet-not-connected** modal + inline CTA + yellow status pill — every guarded action surfaces a clear path forward.

---

## 🏗️ Architecture

<p align="center">
  <img src="./assets/architecture.svg" alt="Kami end-to-end data flow" width="100%"/>
</p>

**Single source of truth.** `server/chat.ts` exports a Web `ReadableStream` powered by Vercel AI SDK `streamText` + `fullStream`. The same factory wires the LLM, the seven tool definitions, the system prompt, and the streaming protocol — consumed by Fastify in local dev (`server/index.ts`) and a Node-style Vercel Function in production (`api/chat.ts`).

**Same-origin RPC.** Every browser RPC call hits `/api/rpc`, a Vercel Function that proxies JSON-RPC to Helius server-side. Keeps the API key off the client, sidesteps CORS, and avoids new-domain reputation issues. Method allowlist + batch-size guard + 120/min rate-limit live on the proxy.

**No private keys server-side.** Transaction build uses `createNoopSigner(walletAddress)` + `compileTransaction` + `getBase64EncodedWireTransaction`. The wallet signs on the client. The server never holds a secret.

**Confirmation by HTTP polling.** Vercel Functions can't upgrade WebSockets, so the default subscription-based `confirmTransaction` would hang. Kami polls `getSignatureStatuses` + `getBlockHeight` over HTTP until `confirmed` or blockhash expiry — exposed as a generator hook in `SignTransactionCard.tsx`.

**Modern wallet discovery.** Featured wallet is [Solflare](https://solflare.com/) via Wallet Standard auto-discovery — no explicit adapter package is imported. `wallets = []` in `WalletProvider.tsx`; modern Solflare registers itself globally and any other Wallet-Standard-compliant wallet (Phantom, Backpack, etc.) shows up under "Use another wallet".

---

## 🚀 Quick Start

```bash
# 1. Clone + install
git clone https://github.com/RECTOR-LABS/kami.git
cd kami
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — fill KAMI_OPENROUTER_API_KEY + SOLANA_RPC_URL

# 3. Run dev server (web :5173 + api :3001 concurrently)
pnpm dev

# 4. Open http://localhost:5173
```

**Required environment variables:**

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `KAMI_OPENROUTER_API_KEY` | LLM access | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `SOLANA_RPC_URL` | Mainnet RPC (recommended: Helius) | [helius.dev](https://helius.dev/) |
| `KAMI_MODEL` *(optional)* | Override default model | Defaults to `anthropic/claude-sonnet-4.6` |

**Optional rate-limit (production-grade):**

| Variable | Purpose |
|----------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint *or* SRH shim URL |
| `UPSTASH_REDIS_REST_TOKEN` | Bearer token |

If the rate-limit env vars are unset, the app runs without rate-limiting locally (still safe — the production deployment enforces them).

---

## 🛠️ Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| **Frontend** | Vite 6 + React 18 + TypeScript 5 + Tailwind 3 | Solflare via Wallet Standard auto-discovery |
| **Chat handler** | Node-style Vercel Function (prod) + Fastify (local dev) | One source of truth in `server/chat.ts` |
| **LLM** | `anthropic/claude-sonnet-4.6` via OpenRouter | Swappable via `KAMI_MODEL` |
| **AI SDK** | Vercel AI SDK v6 — `streamText` + `fullStream` | Tool-call / tool-result events surface to client |
| **DeFi** | `@kamino-finance/klend-sdk` 7.3 on `@solana/kit` v2 | Kamino Main Market |
| **Tx build** | `createNoopSigner` + `compileTransaction` + `getBase64EncodedWireTransaction` | No private keys server-side |
| **Confirmation** | HTTP polling (`getSignatureStatuses` + `getBlockHeight`) | Vercel Functions can't upgrade WebSockets |
| **RPC proxy** | Same-origin `/api/rpc` Vercel Function | Helius mainnet, allowlist-guarded, 120/min |
| **Rate limit** | `@upstash/ratelimit` + self-hosted Redis (Upstash REST shim) | VPS-hosted; fail-open on outage |
| **Streaming** | Web `ReadableStream` piped via `Readable.fromWeb` | Node-style handler protocol |
| **Tests** | Vitest 4 + happy-dom | 186 tests across 21 files |
| **Hosting** | Vercel (Fluid Compute) | Cloudflare DNS-only → Vercel auto-SSL |

---

## 🧪 Testing & Quality

- **186 vitest tests** across 21 files — handlers, RPC guards, rate-limit, kamino helpers, streaming hook, ErrorBoundary, wallet-error classifier, markdown renderer, sidebar, and more
- **Continuous integration** — typecheck (client + server) → tests → build → klend-sdk major-pin guard. The pin guard fails CI if `@kamino-finance/klend-sdk` jumps a major version (e.g., 7.x → 8.x), ensuring breaking SDK changes get a deliberate review.
- **Project-mode TypeScript** — `pnpm exec tsc -b` validates client; `pnpm exec tsc -p server/tsconfig.json --noEmit` validates server + Vercel Functions. Both must pass before push.
- **Coverage focus** — Day 5–8 production-critical surfaces (handlers, guards, ratelimit, walletError, ErrorBoundary) are ≥ 80% covered. Solana SDK orchestration in `server/tools/kamino.ts` is validated via mainnet round-trips, not unit tests — see archived signatures in [Hero moment](./docs/kamino-integration.md#hero-moment--llm-auto-recovery-from-kaminos-dust-floor).
- **27 issues closed** across 10 PRs in the [QA backlog umbrella (#3)](https://github.com/RECTOR-LABS/kami/issues/3). Two-stage code review per task, cluster-level review per sprint, mutation-tested invariants on every cluster.

---

## 🔒 Security & Production Hardening

| Surface | Hardening |
|---------|-----------|
| **HTTP headers** | CSP, HSTS (2y, preload), X-Content-Type-Options=nosniff, X-Frame-Options=DENY, Referrer-Policy, Permissions-Policy, COOP — all in `vercel.json` |
| **RPC proxy** | Method **allowlist** (10 methods) + batch size cap + 120/min rate limit + same-origin only |
| **Chat endpoint** | Zod-validated request schema + 30/min rate limit + server-side `AbortSignal` propagation |
| **Oracle staleness** | Borrows / deposits reject if price feed > ~600 slots stale (matches Pyth/Switchboard) |
| **Top-level boundary** | React `ErrorBoundary` at root catches uncaught render errors with a recovery panel |
| **No keys client-side** | Transaction build via no-op signer; the wallet signs |
| **No keys browser-side** | Helius RPC key never leaves the Vercel Function |
| **Rate-limit fail-open** | If Upstash/SRH fails, requests serve unenforced rather than 500 |
| **Uptime heartbeat** | GitHub Actions ping the Redis backend every 15 minutes |

Full security review notes live in `docs/kamino-integration.md` and the project-internal QA backlog (umbrella [#3](https://github.com/RECTOR-LABS/kami/issues/3)).

---

## 🚢 Deployment

- **Vercel auto-deploys** from `main` → [kami.rectorspace.com](https://kami.rectorspace.com). Custom domain on Cloudflare DNS-only with Vercel auto-SSL.
- **Function timeouts:** `api/chat.ts` = 60s, `api/rpc.ts` = 30s.
- **VPS-hosted Redis** behind a Cloudflare tunnel (`redis-kami.rectorspace.com`) backs the rate-limit. iad1 → ams adds ~100–120 ms per API call (acceptable cost; fail-open on outage).
- **GitLab mirror** via `mirror-gitlab.yml` force-pushes `main` to a backup remote on every commit (resilience after Dec-2025 platform-flag incident).
- **Uptime workflow** (`uptime-redis.yml`) PINGs the Redis backend every 15 min; failures alert via the workflow run.
- **Environment variables** managed via Vercel CLI (`vercel env`) — never checked into the repo.

---

## 📖 Documentation

- **[Kamino Integration Deep-Dive](docs/kamino-integration.md)** — bounty deliverable. Tool-by-tool SDK primitive mapping, architecture walkthrough, hero-moment auto-recovery, edge-case catalog, mainnet validation signatures.
- **[Demo Script](docs/demo-script.md)** — 2:30–2:50 shot list + voice-over for the bounty submission video.
- **[Tweet Thread](docs/tweet-thread.md)** — 5-tweet launch draft + handle verification + posting checklist.
- **[CLAUDE.md](./CLAUDE.md)** — project context for AI-assisted development sessions.

---

## 🏆 Bounty Context

- **Bounty:** [Eitherway Track — Frontier Hackathon 2026](https://superteam.fun/earn/listing/build-a-live-dapp-with-solflare-kamino-dflow-or-quicknode-with-eitherway-app)
- **Submission deadline:** 2026-05-12
- **Sponsors:** Eitherway · Kamino · Solflare · Helius
- **Track angle:** *Build a live dApp with Solflare, Kamino, DFlow, or Quicknode, with Eitherway.* Kami builds with **Eitherway** (scaffold + deploy pipeline), **Kamino** (klend SDK + Main Market), **Solflare** (featured wallet via Wallet Standard), and **Helius** (RPC proxy). Three sponsor surfaces, one focused product.

---

## 🙏 Acknowledgments

Special thanks to the protocols, platforms, and people who made Kami possible:

### 🔗 Solana Ecosystem
- **[Kamino Finance](https://kamino.finance/)** — `@kamino-finance/klend-sdk`, the Main Market, the protocol that this entire project celebrates
- **[Solflare](https://solflare.com/)** — featured wallet, Wallet Standard pioneer, and one of the cleanest Solflare-Web3.js bridges in the ecosystem
- **[Helius](https://helius.dev/)** — fast and reliable RPC infrastructure, plus the DAS API that makes Solana asset queries pleasant
- **[Anza](https://anza.xyz/)** — `@solana/kit` v2, the modern tree-shakeable JS SDK that klend 7.x runs on

### 🛠️ Infrastructure
- **[Eitherway](https://eitherway.ai/)** — initial scaffold + deploy pipeline (tagged `eitherway-v0` on 2026-04-19)
- **[Vercel](https://vercel.com/)** — hosting, Fluid Compute, AI SDK v6, and the cleanest Node-style Function runtime in the business
- **[Anthropic](https://www.anthropic.com/)** — Claude Sonnet 4.6 (the model that powers Kami's reasoning)
- **[OpenRouter](https://openrouter.ai/)** — model gateway

### 🏗️ Tooling
- **[Vite](https://vite.dev/)** + **[React](https://react.dev/)** + **[Tailwind](https://tailwindcss.com/)** — modern frontend trifecta
- **[Vitest](https://vitest.dev/)** + **[happy-dom](https://github.com/capricorn86/happy-dom)** — fast tests that don't bring a browser
- **[Upstash](https://upstash.com/)** + **[`@upstash/ratelimit`](https://github.com/upstash/ratelimit-js)** — drop-in production rate-limit with a clean REST shim story
- **[Cloudflare](https://www.cloudflare.com/)** — DNS, tunnels, and the safety net under the VPS-Redis backend

### 📡 Community
- **[Superteam](https://superteam.fun/)** — bounty platform that hosts the Frontier Hackathon
- **Solana developer community** — endless docs, examples, and patience

---

## 🌱 Origin

Initial scaffold generated by [Eitherway](https://eitherway.ai/) on 2026-04-19 (tagged `eitherway-v0`). Everything after is custom: Fastify + Vercel Function backends, Kamino SDK integration, the seven-tool suite, same-origin RPC proxy, preflight simulation, oracle-staleness gate, Sign & Send card, polling-based confirmation, top-level ErrorBoundary, rate-limit infrastructure, and the entire UX polish layer (Sprints 1–4 of the QA backlog).

---

## 📜 License

Released under the **[MIT License](LICENSE)** — see [`LICENSE`](LICENSE) for the full text.

You're free to fork, study, modify, and redistribute Kami for any purpose, including commercial use. Attribution is appreciated but not required by the license.

---

<div align="center">

**🏆 Built for the Eitherway Track · Frontier Hackathon 2026**

*Bismillah. Built with care, shipped with rigor.*

[![Live](https://img.shields.io/badge/live-kami.rectorspace.com-7c3aed?logo=vercel&logoColor=white)](https://kami.rectorspace.com)
[![Repo](https://img.shields.io/badge/repo-RECTOR--LABS%2Fkami-181717?logo=github&logoColor=white)](https://github.com/RECTOR-LABS/kami)
[![Bounty](https://img.shields.io/badge/bounty-Eitherway%20Track-orange)](https://superteam.fun/earn/listing/build-a-live-dapp-with-solflare-kamino-dflow-or-quicknode-with-eitherway-app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[🐛 Report a bug](https://github.com/RECTOR-LABS/kami/issues) · [📖 Integration docs](docs/kamino-integration.md) · [🎬 Demo script](docs/demo-script.md)

</div>
