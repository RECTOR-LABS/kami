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

Hero moment: the LLM auto-recovers from Kamino's `NetValueRemainingTooSmall` dust floor.

buildRepay fails → getPortfolio refreshes → buildRepay with 0.001 USDC buffer → confirmed on mainnet.

No hard-coded retry loop. The system prompt teaches the LLM to read the error code and reason about the dust floor.

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

## Character counts (sanity)

| # | Chars | Under 280? |
|---|-------|-----------|
| 1 | ~258  | ✓ |
| 2 | ~246  | ✓ |
| 3 | ~274  | ✓ |
| 4 | ~240  | ✓ |
| 5 | ~275  | ✓ |

All tweets fit within Twitter's 280-char limit with some headroom. If a handle change pushes one over, trim the "Feedback welcome" line in T5.

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
