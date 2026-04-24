# Kami Demo — Shot List & Script (60–90 s)

Target length: 60–90 seconds. Recorded on `kami.rectorspace.com`, Solflare (featured wallet), Kamino Main Market mainnet.

Hero beat: **plain English → signed mainnet tx, every time**. The "wow" moment is the LLM's NetValueRemainingTooSmall auto-recovery in Shot 6 — surface it explicitly in the voice-over.

## Cold open (0:00–0:05)

Shot: architecture.svg full-frame, 3-second zoom-in from the SOLANA MAINNET stage to the CLIENT stage, reversing the data flow.

VO: "Kami. Type what you want. Kamino does it. Mainnet."

## Shot 1 — Welcome + connect (0:05–0:15)

UI: `kami.rectorspace.com` landing — "Welcome to Kami" tiles visible, 4 suggestion chips along the bottom, "Connect with Solflare" orange CTA center.

Action: click "Connect with Solflare" → Solflare extension popup → Approve. Wallet badge `HciZ..25En` appears top-right, tiles stay, CTA disappears.

VO: "Connect a Solana wallet — Solflare, Phantom, or anything Wallet-Standard compatible. No new accounts."

## Shot 2 — Find yield (0:15–0:25)

Action: click the chip **"What's the best USDC supply APY on Kamino right now?"** → it auto-submits.

UI: tool-call badges render: `Calling findYield` (green). Assistant streams a markdown **table** with columns [Market · Reserve · Supply APY · Borrow APY · Utilization]. Top row highlighted.

VO: "Ask in plain English. Kami calls `findYield`, streams the live reserve table — real APYs, real utilization, live."

## Shot 3 — Simulate risk (0:25–0:35)

Action: type **"Will borrowing 0.05 USDC liquidate me if I deposit 0.2 USDC first?"** → send.

UI: tool-call badges `getPortfolio` → `simulateHealth`. Assistant replies with Health Factor 3.60, LTV 25%, LLT 85%, highlighted "SAFE" verdict.

VO: "Before you touch anything: simulate. Kami projects your health factor, LTV, and liquidation thresholds — so you know before you sign."

## Shot 4 — Deposit (0:35–0:50)

Action: type **"Deposit 5 USDC into Kamino"** → send.

UI: `Calling buildDeposit`. Card slides in: "Deposit 5 USDC on Kamino main market" with Action / Amount / Protocol / Reserve. Purple "Sign & Send" button.

Action: click **Sign & Send** → Solflare popup → Approve.

UI: card flips — "Submitted — waiting for confirmation…" spinner → "Confirmed on mainnet" green pill → Solscan link.

VO: "One sentence. Kami builds a versioned transaction, preflights on-chain, surfaces the `Sign & Send` card. Wallet signs client-side — server never holds a key. Confirmed on mainnet."

## Shot 5 — Borrow (0:50–1:00)

Action: type **"Borrow 0.05 USDC"** → send.

UI: `buildBorrow` card → Sign & Send → Solflare Approve → Confirmed on mainnet.

VO: "Open a borrow with one line. Every tool — deposit, borrow, withdraw, repay — builds a real v0 tx with a fresh blockhash and a preflight simulation baked in."

## Shot 6 — Repay + auto-recovery ⭐ (1:00–1:15)

Action: type **"Repay all my Kamino USDC borrow"** → send.

UI: tool-call badges cascade — `Fetching Kamino portfolio` → `Calling buildRepay failed` (red) → `Calling buildRepay` (green). Assistant explains inline: "Kamino's program threw `NetValueRemainingTooSmall`... let me retry with a small buffer." → new repay card for 0.051 USDC with "covers your ~0.050027 USDC balance + a tiny buffer for accrued interest."

Action: click Sign & Send → Solflare Approve → Confirmed on mainnet.

VO: "Protocol guardrail triggers — on-chain interest accrued since the balance snapshot, so the repay would leave dust. Kami reads the error, adds a buffer, retries. Zero user intervention."

## Shot 7 — Withdraw all (1:15–1:25)

Action: type **"Withdraw all my Kamino USDC"** → send.

UI: `buildWithdraw` card for 5.200084 USDC (principal + accrued interest). Sign & Send → Confirmed on mainnet.

VO: "Close out. Principal plus accrued interest, back in the wallet. Round-trip complete."

## Closer (1:25–1:30)

Shot: three Solscan links stacked on a dark background with the Kami K logo.

VO: "Kami — Eitherway track, Frontier Hackathon 2026. Deployed on Vercel. Open-source. Three mainnet transactions in ninety seconds. kami dot rectorspace dot com."

---

## Production checklist

- [ ] Test wallet topped up (≥ 0.1 SOL, ≥ 6 USDC) before recording. Shot 6's auto-recovery needs a buffer of at least $5 equivalent in the obligation.
- [ ] Network stable — ideally wired, or turn off Wi-Fi interference. Vercel p95 first-byte is ~300 ms but Solflare preflight retries are transient; 1–2 restarts are expected.
- [ ] Disable notifications, close other tabs.
- [ ] Record 1440×900 native, export 1080p for YouTube/X.
- [ ] Voice-over recorded separately, mixed in post — VO here is ~90 s at ~110 wpm.
- [ ] Captions: bake in every VO line + every UI action (tool-call badges fly by too fast to read otherwise).
- [ ] Cold-start gotcha: first AI message triggers the lazy markdown chunk fetch (~48 kB). Pre-warm by running Shot 1 + Shot 2 off-camera, then start recording.
- [ ] Have a fallback take plan for Shot 6 — if the auto-recovery doesn't trigger (interest rate could change), switch to Shot 6b (partial-repay-then-full with a manual buffer). Don't improv.

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
