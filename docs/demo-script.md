# Kami Demo — Shot List & Script (2:30–2:50)

Target length: **2 min 30 s – 2 min 50 s** (bounty requires 2–3 minutes). Recorded on `kami.rectorspace.com`, Solflare (featured wallet), Kamino Main Market mainnet.

Hero beat: **plain English → signed mainnet tx, every time**. The "wow" moment is the LLM's NetValueRemainingTooSmall auto-recovery in Shot 7 — surface it explicitly in the voice-over.

## Cold open (0:00–0:10)

Shot: `architecture.svg` full-frame, 3-second zoom-in from the SOLANA MAINNET stage to the CLIENT stage, reversing the data flow. Title-card overlay: **"Kami"** fades in at 0:04, subtitle **"A conversation-driven co-pilot for Kamino Finance on Solana"** fades in at 0:07.

VO: *"Kami. Type what you want. Kamino does it. Mainnet."*

## Shot 1 — What is Kami (0:10–0:25)

Shot: fast montage — split-screen of the Kamino app dashboard on the left (busy, lots of tables and numbers) fading to black, then fading to the Kami chat UI on the right (clean, single input).

VO: *"DeFi dashboards assume you already know what you're doing. Kami flips that: you describe what you want — find yield, check health, deposit, borrow, repay — and an AI co-pilot orchestrates the real Kamino protocol to do it. Seven tools. One chat box. Live Solana mainnet."*

## Shot 2 — Connect (0:25–0:40)

UI: `kami.rectorspace.com` landing — gradient **K** logo + "Welcome to Kami" heading, four feature cards arranged in a 2×2 grid (**Live Yields** / **Build & Sign** / **Portfolio** / **Health Sim**), and the orange **Connect with Solflare** CTA below the grid.

Action: click **Connect with Solflare** → Solflare extension popup → Approve. Wallet badge `HciZ..25En` appears top-right, the cards stay, the Connect CTA disappears.

VO: *"Connect a Solana wallet — Solflare recommended, or anything Wallet-Standard compatible. No new accounts, no sign-in forms. The wallet is the auth."*

## Shot 3 — Find yield (0:40–0:55)

Action: click the **Live Yields** card (top-left of the 2×2 grid) → it fires *"What are the best Kamino yields right now?"* and auto-submits.

UI: tool-call badges render: `Calling findYield` (green). Assistant streams a markdown **table** with columns [Market · Reserve · Supply APY · Borrow APY · Utilization]. Top row highlighted.

VO: *"Ask in plain English. Kami calls `findYield` — a thin wrapper over Kamino's klend SDK — streams the live reserve table. Real APYs from the on-chain Scope oracle. Real utilization. Main Market, live."*

## Shot 4 — Simulate risk (0:55–1:15)

Action: type **"Will borrowing 0.05 USDC liquidate me if I deposit 0.2 USDC first?"** → send.

UI: tool-call badges `getPortfolio` → `simulateHealth`. Assistant replies with Health Factor 3.60, LTV 25%, LLT 85%, highlighted "SAFE" verdict. A small aside flags "projected health factor 3.60 — no liquidation risk."

VO: *"Before you touch anything — simulate. Kami reads your current obligation, projects the health factor after the hypothetical action, flags anything that would drop you below 1.1 or trip a liquidation. The LLM's system prompt forces this step before any borrow."*

## Shot 5 — Deposit (1:15–1:40)

Action: type **"Deposit 5 USDC into Kamino"** → send.

UI: `Calling buildDeposit`. Card slides in: **Deposit 5 USDC on Kamino main market** with Action / Amount / Protocol / Reserve. Purple **Sign & Send** button.

Action: click **Sign & Send** → Solflare popup → Approve.

UI: card flips — "Submitted — waiting for confirmation…" spinner → "Confirmed on mainnet" green pill → Solscan link.

VO: *"One sentence. Kami calls `KaminoAction.buildDepositTxns` — the real Kamino SDK — builds a versioned transaction with a fresh blockhash, preflight-simulates it on-chain to catch missing rent. The server never holds a private key: it uses a no-op signer and returns base64 wire bytes. Your wallet signs, the client submits, HTTP polls confirmation. Thirty seconds later — on-chain."*

## Shot 6 — Borrow (1:40–1:55)

Action: type **"Borrow 0.05 USDC"** → send.

UI: tool-call badges `simulateHealth` → `buildBorrow` card → Sign & Send → Solflare Approve → Confirmed on mainnet.

VO: *"Open a borrow with one line. Every write tool — deposit, borrow, withdraw, repay — follows the same pattern: simulate, build, sign, confirm. No raw transaction JSON, ever."*

## Shot 7 — Repay + auto-recovery ⭐ (1:55–2:25)

Action: type **"Repay all my Kamino USDC borrow"** → send.

UI: tool-call badges cascade — `Fetching Kamino portfolio` → `Calling buildRepay` (red — failed) → `Calling buildRepay` (green — retry). Assistant explains inline: *"Kamino's program threw `NetValueRemainingTooSmall` — accrued interest means repaying exactly my balance would leave dust. Let me retry with a small buffer."* → new repay card for 0.051 USDC with the caption *"covers your ~0.050027 USDC balance + a tiny buffer for accrued interest."*

Action: click **Sign & Send** → Solflare Approve → Confirmed on mainnet.

VO: *"Here's what deep integration looks like. On the first attempt, Kamino's program rejects the repay — interest accrued between the balance read and the transaction, and exact-repay would leave the obligation with dust, which the protocol forbids. Kami reads the specific error code, asks the chain for a fresh balance, and retries with a conservative buffer. Zero user intervention. That's the LLM reasoning over a real protocol edge case, not a hand-coded retry loop."*

## Shot 8 — Withdraw all (2:25–2:40)

Action: type **"Withdraw all my Kamino USDC"** → send.

UI: `buildWithdraw` card for 5.200084 USDC (principal + accrued interest). Sign & Send → Confirmed on mainnet.

VO: *"Close out. Principal plus the accrued interest, back in the wallet. Three signed transactions, full round-trip."*

## Closer (2:40–2:50)

Shot: three Solscan tx hashes animate in one by one, stacked on a dark background with the Kami **K** logo. Bottom-row credits scroll: *"Built with Eitherway · Kamino · Solflare · Helius · Vercel AI SDK"*.

VO: *"Kami. Eitherway track, Frontier Hackathon 2026. Scaffold generated by Eitherway, extended with Vercel Functions, the Kamino klend SDK, and Solflare as the featured wallet. Open-source. Live at kami dot rectorspace dot com."*

---

## Production checklist

- [ ] **Test wallet topped up (≥ 0.1 SOL, ≥ 15 USDC) before recording.** Shot 5 deposits 5 USDC; Shot 6 borrows 0.05 USDC; Shot 7 repays full. The auto-recovery in Shot 7 needs the obligation's net value to land **above ~$5 USD floor** after repay — meaning the deposit must be ≥ $10 (5 supplied + 5+ buffer). Empirically validated 2026-05-01: wallets with $4-6 USD net position cannot close cleanly via Kami; only Kamino UI's atomic Repay Max can close them.
- [ ] Network stable — ideally wired, or turn off Wi-Fi interference. Vercel p95 first-byte is ~300 ms but Solflare preflight retries are transient; 1–2 restarts are expected.
- [ ] Disable notifications, close other tabs.
- [ ] Record 1440×900 native, export 1080p for YouTube/X.
- [ ] Voice-over recorded separately, mixed in post. Script is **~330 words** (~2:30–2:50 @ 130 wpm). Trim or pad where natural pauses land.
- [ ] Captions: bake in every VO line + every UI action (tool-call badges fly by too fast to read otherwise).
- [ ] Cold-start gotcha: first AI message triggers the lazy markdown chunk fetch (~48 kB). Pre-warm by running Shot 2 + Shot 3 off-camera, then start recording.
- [ ] Have a fallback take plan for Shot 7 — if the auto-recovery doesn't trigger (interest rate could change so exact-repay might randomly succeed), switch to Shot 7b (partial-repay-then-full with a manual buffer). Don't improv.
- [ ] Title + subtitle overlays in Shot 1 (at 0:04 and 0:07) require post-production; keep the raw recording clean so the overlays can be added later.

## Archive signatures (today's 3 validated the flow)

- Deposit 5 USDC: `4QLiamwYufE9423dt2T6Qa4SJsRypjfiX8qrfFmxjq98Fc2Bf4ZSchNvWhpE1SBKtCqJUX5ZXwYJMpL6a4zHdYKJ`
- Repay 0.051 USDC: `utDVXM4u8ybWUfq1kAkmhH1vd1uHkCoDdSeMhvUZxriS2JDG9VXFwg2epgU8gvNPdX51WZ4YjG1vWBrAngSLCX5`
- Withdraw 5.200084 USDC: `5QcBFn6LVMYsNsQjRiF6UhQSJ9WtbYBoDKdeKJycpD3W5pAMorp9ELuuz3MUz6tipQthZGsMYBLQUZngqU2CX7x1`

If the live recording hits the NetValueRemainingTooSmall floor but the LLM's auto-recovery fails (e.g. because it short-circuits on fast re-reads), fall back to these signatures as on-screen proof: zoom-in on Solscan for each.

## Backup deliverables if video slips

If the video isn't ready by submission deadline (2026-05-12):

1. **GIF walkthrough** — screen-recorded, looped. 15–20 MB cap for X/GitHub. Use `kap` or `gifski` to compress.
2. **Three screenshots + captions in README** — deposit card / simulate verdict / confirmed-on-mainnet. Judges can read in 10 s.
3. **Storyboard document** — this file, minus the VO lines, with UI screenshots inline. Not ideal, but demonstrates rigor.

Priority: GIF > README screenshots > storyboard doc. A 10-second GIF of "type → tx lands" is worth more than any polished narration.

## Edge cases & known limits (added 2026-05-01 from Day 23 testing)

These DO NOT block the demo if the production checklist above is followed, but documenting for transparency.

### NetValueRemainingTooSmall floor (~$5 USD)

Kamino's klend program rejects any action that would drop the obligation's net value below ~$5. This bites on:
- "Repay all" when current net is already < $10 (because repay reduces net)
- "Withdraw all USDC" when there's any open borrow (creates negative net)

Fix: collateral discipline — keep ≥ $10 deposit when fully closing positions, OR use Kamino UI's Repay Max which handles atomic close-out via a different program path. Kami's `buildRepay` tool now returns structured `errorCode: 'dust-floor'` so the LLM can suggest the right recovery (see Cluster H / PR #54).

### First-time Kamino rent (~0.022 SOL)

Permanently locked per (user, market) pair. klend has no `close_obligation` instruction. Fund accordingly — first deposit needs an extra ~0.05 SOL on top of the deposit amount.

### Solflare opaque sign+broadcast (OBSOLETE — fixed in Cluster H / PR #54)

Pre-PR-#54: Solflare's `signAndSendTransaction` did sign+broadcast inside the browser extension, using its own RPC and bypassing our `/api/rpc` proxy. Failures came back as empty `WalletSendTransactionError` with zero observability. Cluster H switched `TxStatusCard` to explicit `signTransaction` + manual `connection.sendRawTransaction(...)` so all errors are now structured and routed through our Helius proxy.
