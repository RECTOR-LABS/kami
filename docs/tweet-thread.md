# Kami — Tweet Thread (launch / submission)

Target: 5 tweets. For the Eitherway Track, Frontier Hackathon 2026 submission. Post when the demo video is live so T3 can link to it.

**Verify every @ handle before posting** — these are my best guesses (Twitter handles drift). Replace any that don't resolve:

- `@KaminoFinance` — probably correct
- `@solflare_wallet` — probably correct
- `@heliuslabs` — correct as of recent memory
- `@Eitherway` — uncertain (could be `@eitherwayai` or plain brand mention — check eitherway.ai footer)
- `@vercel` — correct
- `@AnthropicAI` — correct
- `@SuperteamDAO` — probably correct for tagging the bounty platform

---

## Draft

**1/5**

Kami — an AI co-pilot for @KaminoFinance on Solana.

Type: "best USDC yield", "will this borrow liquidate me?", "deposit 5 USDC", "repay everything."

The LLM orchestrates real Kamino SDK calls → ready-to-sign mainnet tx.

Live: kami.rectorspace.com

---

**2/5**

Seven tools. Each mapped 1:1 to a klend-sdk primitive:

• getPortfolio
• findYield
• simulateHealth
• buildDeposit / buildBorrow / buildRepay / buildWithdraw

Live-validated mainnet. No middleware, no hand-rolled IX — every write calls `KaminoAction.build*Txns` directly.

---

**3/5**

Hero moment: LLM auto-recovers Kamino's `NetValueRemainingTooSmall` dust floor.

buildRepay fails → getPortfolio refreshes → buildRepay with a tiny buffer → confirmed on mainnet.

No hard-coded retry. The prompt teaches the LLM to read the error and reason about it.

---

**4/5**

Stack:

• @Eitherway — scaffold origin + deploy pipeline
• @KaminoFinance — klend SDK, Main Market
• @solflare_wallet — featured wallet, Solana wallet-standard
• @heliuslabs — RPC proxy + preflight simulation
• @vercel AI SDK + @AnthropicAI Sonnet 4.6

---

**5/5**

Built for the Eitherway Track, Frontier Hackathon 2026 (Kamino prize).

Repo (open-source): github.com/RECTOR-LABS/kami
Integration docs: github.com/RECTOR-LABS/kami/blob/main/docs/kamino-integration.md
Live: kami.rectorspace.com

Feedback welcome. Break it, find edge cases, tag me.

---

## Character counts (sanity — re-counted with Python `len()`)

| # | Raw chars | X-weighted* | Under 280? |
|---|----------:|------------:|-----------|
| 1 | 249       | 252         | ✓ |
| 2 | 271       | 271         | ✓ |
| 3 | 266       | 266         | ✓ |
| 4 | 251       | 251         | ✓ |
| 5 | 283       | ~242        | ✓ (via URL weighting) |

\* X counts every URL as a flat 23 chars regardless of length, so T5's three links shrink the effective count. Verify in the X composer before posting anyway; handle resolutions can shift numbers by a few chars.

---

## Posting checklist

- [ ] Replace handles verified above. Confirm each in the browser (typing `@` should auto-complete).
- [ ] Record + publish demo video FIRST — then edit T3 or T5 to link the video (add `Video: <URL>` as last line of T5). 2-3 min YouTube / X native upload.
- [ ] Add the `architecture.svg` as the image attachment on T1 (dark-mode diagram makes a strong thumbnail).
- [ ] Optional: attach one of the mainnet tx Solscan links (`4QLiam...dYKJ` deposit, `utDVX...LCX5` repay, `5QcBF...CX7x1` withdraw) as inline screenshots on T3 to prove the auto-recovery.
- [ ] Pin the thread on @RECTOR profile for submission-window visibility.

---

## Alternative framings (not used, but stash for re-runs)

**Shorter version (3 tweets)** — if the full thread feels too long:
- T1: Pitch + live URL
- T2: Hero auto-recovery moment
- T3: Stack + repo + submission context

**Contrarian hook** — if "announce my hackathon submission" feels too clean:
> "Most DeFi dashboards make you memorize numbers before you act. I built one where you describe what you want in one sentence. Real Kamino mainnet, real signed tx, same 5 seconds."

**Technical deep-dive version** — if engineers are the audience:
> "How I wired klend-sdk's `KaminoAction.build*Txns` into an LLM tool chain without ever touching a private key server-side (thread) 👇"
