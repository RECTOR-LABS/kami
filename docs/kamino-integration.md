# Kamino Integration — How Kami Uses Kamino

This document explains how **Kami** integrates with [Kamino Finance](https://kamino.finance/) — specifically the **klend** lending protocol — as required by the Eitherway Track — Frontier Hackathon 2026 submission guidelines ("Integration documentation explaining how you use partner infrastructure").

---

## Thesis

Most users of on-chain lending protocols interact through a dashboard: they open the app, eyeball APY numbers, click a button, sign. That interaction model scales badly with complexity — cross-asset health-factor math, yield comparison, risk-sensitive actions — because every decision requires the user to load context into their own head.

Kami replaces the dashboard with a conversation. The user types in plain English (*"best USDC yield on Kamino"*, *"what if I borrow 50 USDC against my SOL — will I get liquidated?"*, *"repay everything and close the loan"*) and an LLM-orchestrated tool chain delivers a natural-language answer plus — when the request is actionable — a ready-to-sign mainnet transaction built with the real Kamino SDK.

The integration is **deep**, not surface-level: the LLM's tool suite is Kamino's core primitives, wrapped one-to-one. Kami's value is not the Kamino protocol itself (that's Kamino's) — it's turning Kamino from a dashboard into a co-pilot.

---

## Tool surface

All seven tools live in [`server/tools/kamino.ts`](../server/tools/kamino.ts) and are registered with the LLM via [`server/chat.ts`](../server/chat.ts) using the Vercel AI SDK's `tool()` primitive + zod input schemas. The LLM is instructed ([`server/prompt.ts`](../server/prompt.ts)) to use them aggressively instead of guessing.

| # | Tool | Kind | klend-sdk primitive used |
|---|------|------|--------------------------|
| 1 | `getPortfolio` | read | [`KaminoMarket.load`](https://github.com/Kamino-Finance/klend-sdk) + [`VanillaObligation.toPda`](https://github.com/Kamino-Finance/klend-sdk) + [`market.getObligationByAddress`](https://github.com/Kamino-Finance/klend-sdk) + [`obligation.refreshedStats`](https://github.com/Kamino-Finance/klend-sdk) |
| 2 | `findYield` | read | [`market.reserves`](https://github.com/Kamino-Finance/klend-sdk) + [`reserve.totalSupplyAPY(slot)`](https://github.com/Kamino-Finance/klend-sdk) / [`reserve.totalBorrowAPY(slot)`](https://github.com/Kamino-Finance/klend-sdk) + [`reserve.getOracleMarketPrice()`](https://github.com/Kamino-Finance/klend-sdk) |
| 3 | `simulateHealth` | read | [`obligation.getSimulatedObligationStats({ action, reserves, slot, amountCollateral / amountDebt, mintCollateral / mintDebt })`](https://github.com/Kamino-Finance/klend-sdk) |
| 4 | `buildDeposit` | write | [`KaminoAction.buildDepositTxns(...)`](https://github.com/Kamino-Finance/klend-sdk) |
| 5 | `buildBorrow` | write | [`KaminoAction.buildBorrowTxns(...)`](https://github.com/Kamino-Finance/klend-sdk) |
| 6 | `buildWithdraw` | write | [`KaminoAction.buildWithdrawTxns(...)`](https://github.com/Kamino-Finance/klend-sdk) |
| 7 | `buildRepay` | write | [`KaminoAction.buildRepayTxns(...)`](https://github.com/Kamino-Finance/klend-sdk) |

**Target market:** Kamino Main Market at `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF` (pinned in [`server/tools/kamino.ts:30`](../server/tools/kamino.ts)).

### Read tools — the LLM's situational awareness

`getPortfolio` is how the LLM learns about the user's actual on-chain position. It resolves the Vanilla obligation PDA from the user's wallet + market, then reads the refreshed obligation stats for total-deposited-USD, total-borrowed-USD, LTV, liquidation LTV, and per-position APY. The health factor is computed client-side as `liquidationLtv / loanToValue` so the LLM can reason about risk in the same breath as it cites the position.

`findYield` ranks every active reserve on the market by live supply or borrow APY (LLM-selectable). It also returns the reserve's oracle price, LTV cap, liquidation threshold, and live utilisation — enough context for a nuanced answer like *"JitoSOL pays 7.2% on supply but LTV is capped at 60% and utilisation is already 92% — borrowing JitoSOL right now is likely to fail."*

`simulateHealth` projects the user's obligation stats after a hypothetical `deposit` / `borrow` / `withdraw` / `repay`. It calls Kamino's own simulation path (`obligation.getSimulatedObligationStats`) so the projected LTV matches what an actual action would produce on-chain. The tool also flags projected health factors below 1.1 and below 1.0 as warnings — the LLM is instructed (`server/prompt.ts`) to run `simulateHealth` **before** any borrow and refuse to proceed if the projected position would liquidate.

### Write tools — the Sign & Send pattern

Every `build*` tool produces an unsigned v0 transaction and returns it to the LLM as `base64Txn` + `blockhash` + `lastValidBlockHeight` metadata. The LLM never signs; the user's wallet does. This is enforced by construction:

```ts
const ownerSigner = createNoopSigner(wallet);  // server builds for `wallet` but has no key
const kaminoAction = await KaminoAction.buildDepositTxns(market, amountStr, mint, ownerSigner, ...);
const compiledTx = compileTransaction(txMessage);
const base64Txn = getBase64EncodedWireTransaction(compiledTx);
```

(Exact pattern in [`server/tools/kamino.ts:614-700`](../server/tools/kamino.ts).)

The UI renders a Sign & Send card (`src/components/SignTransactionCard.tsx`) with the exact action / amount / protocol; the user signs with their wallet; the client submits via a same-origin `/api/rpc` proxy; confirmation is polled over HTTP (`getSignatureStatuses` + `getBlockHeight`) since Vercel Functions cannot upgrade the WebSockets that `connection.confirmTransaction` requires.

**Preflight simulation:** every `build*` tool runs `simulateTransaction` against the compiled payload **before** returning it ([`server/tools/kamino.ts:424-490`](../server/tools/kamino.ts)). If the wallet is short on SOL for first-time Kamino account rent, Kami surfaces the precise shortfall in lamports — the user sees an exact top-up amount instead of burning a failed-tx fee discovering it at sign-time.

---

## Hero moment — LLM auto-recovery from Kamino's dust floor

Kamino's klend rejects any action that would leave an obligation with a net value below a minimum threshold (`NetValueRemainingTooSmall`, Anchor error `0x17cc`). This protects solvency but breaks "repay-all" and "withdraw-to-zero" flows that hit the floor by rounding.

Kami's LLM handles this autonomously: when `buildRepay` fails with the dust-floor error, it re-calls `getPortfolio` to see the latest refreshed amount, then re-calls `buildRepay` with a conservative buffer (~1% of the borrow). Second attempt confirms.

**Live mainnet proof — 2026-04-24:**

| Stage | Signature |
|------|----------|
| Deposit 5 USDC | [`4QLiamwYufE9423dt2T6Qa4SJsRypjfiX8qrfFmxjq98Fc2Bf4ZSchNvWhpE1SBKtCqJUX5ZXwYJMpL6a4zHdYKJ`](https://solscan.io/tx/4QLiamwYufE9423dt2T6Qa4SJsRypjfiX8qrfFmxjq98Fc2Bf4ZSchNvWhpE1SBKtCqJUX5ZXwYJMpL6a4zHdYKJ) |
| **Repay 0.051 USDC (after auto-retry)** | [`utDVXM4u8ybWUfq1kAkmhH1vd1uHkCoDdSeMhvUZxriS2JDG9VXFwg2epgU8gvNPdX51WZ4YjG1vWBrAngSLCX5`](https://solscan.io/tx/utDVXM4u8ybWUfq1kAkmhH1vd1uHkCoDdSeMhvUZxriS2JDG9VXFwg2epgU8gvNPdX51WZ4YjG1vWBrAngSLCX5) |
| Withdraw 5.200084 USDC | [`5QcBFn6LVMYsNsQjRiF6UhQSJ9WtbYBoDKdeKJycpD3W5pAMorp9ELuuz3MUz6tipQthZGsMYBLQUZngqU2CX7x1`](https://solscan.io/tx/5QcBFn6LVMYsNsQjRiF6UhQSJ9WtbYBoDKdeKJycpD3W5pAMorp9ELuuz3MUz6tipQthZGsMYBLQUZngqU2CX7x1) |

These are the exact transactions that land when a user follows the conversational flow end-to-end. The LLM's recovery logic is prompt-driven — no code path for the retry, just a system prompt that instructs it to `getPortfolio` on dust-floor errors and pass through a slightly-smaller amount. The framework handles the rest.

---

## Request flow — what happens when the user says "deposit 5 USDC"

```
user types in chat
      ↓
useChat.ts stream opens to /api/chat
      ↓
streamText({ model: claude-sonnet-4.6, tools: TOOLS, messages: [...] })
      ↓
LLM decides to call buildDeposit({ symbol: "USDC", amount: 5 })
      ↓
server/tools/kamino.ts:
  - address(walletAddress)                             # wallet → Address
  - getMarket()                                        # cached KaminoMarket
  - market.getReserveBySymbol("USDC")                  # find reserve
  - new Decimal(5).mul(10^decimals)                    # 5 → lamports
  - createNoopSigner(wallet)                           # no-key signer
  - KaminoAction.buildDepositTxns(...)                 # klend-sdk builds ixs
  - pipe(
      createTransactionMessage({ version: 0 }),
      setTransactionMessageFeePayerSigner(ownerSigner),
      setTransactionMessageLifetimeUsingBlockhash(latestBlockhash),
      appendTransactionMessageInstructions(allIxs)
    )                                                  # @solana/kit v0 tx
  - compileTransaction(txMessage)                      # freeze
  - getBase64EncodedWireTransaction(compiledTx)        # wire format
  - simulateTransaction(base64Txn)                     # preflight → catch rent
      ↓
ToolResult { ok: true, data: { base64Txn, blockhash, lastValidBlockHeight, summary } }
      ↓
AI SDK serialises the result back into the stream
      ↓
ChatMessage.tsx sees a buildDeposit tool-result → renders SignTransactionCard
      ↓
user clicks Sign → wallet pops → user signs
      ↓
client.sendTransaction(signedTx) → /api/rpc → Helius
      ↓
pollSignatureStatus every 1.5s → status=confirmed OR blockhash expired
      ↓
UI flips to green "Confirmed on mainnet" with Solscan link
```

---

## Why this qualifies as "deep" integration

From the Kamino track brief: *"Uses Kamino as a core engine of the product."*

- **Zero generic lending code.** Every read + write path in Kami calls a Kamino SDK method — `KaminoMarket.load`, `market.getReserveBySymbol`, `reserve.totalSupplyAPY`, `KaminoAction.buildDepositTxns`, `obligation.getSimulatedObligationStats`. There is no abstraction layer hiding Kamino behind a generic "DeFi" interface.
- **LLM system prompt encodes Kamino domain.** `server/prompt.ts` teaches the LLM Kamino-specific concepts (klend / multiply / kliquidity / Scope, the main-market address, health-factor semantics, dust-floor behaviour). Swapping protocols would be a full rewrite, not a config flip.
- **Error handling is Kamino-aware.** The dust-floor auto-recovery, the first-time-deposit rent preflight, and the `getUserVanillaObligation`-throws-on-empty workaround ([`server/tools/kamino.ts:112-118`](../server/tools/kamino.ts)) are all reactions to real Kamino edge cases, not generic SDK bugs.
- **Live-validated mainnet.** Every tool has at least one signed mainnet transaction proving the full chat → LLM → SDK → wallet → Solana loop works end-to-end.

---

## Known limits & extension points

- **Main market only.** Kami currently binds to the Kamino Main Market at `7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF`. Other markets (Jito, Multiply, etc.) would need per-market reserve symbol disambiguation.
- **Klend only.** No kliquidity (concentrated LP vault) or Multiply (one-click leverage) integration yet. The klend tools provide most of the user-facing surface; those products extend it.
- **No obligation close path.** Kamino's obligation account stays open with ~0.022 SOL of rent permanently locked after withdraw-all + repay-all. Verified empirically (2026-04-25): neither Kamino's own UI nor the klend program exposes a `close_obligation` instruction — IDL scan = 51 instructions with zero close candidates; Kamino's Portfolio UI has no close affordance; Transaction History on the test wallet shows only Deposit / Withdraw / Borrow / Repay types across its entire lifetime. This is a Kamino protocol-level gap, not a Kami scope item — a `closeObligation` Kami tool is technically impossible until Kamino ships the instruction upstream. (ATAs for cTokens remain recoverable via standard SPL `close_account` once emptied, ~0.002 SOL each.)
- **Oracle price display is advisory.** `findYield` surfaces `reserve.getOracleMarketPrice()` but Kami does not independently validate Scope oracle freshness; the SDK handles that.

---

## Stack

- [`@kamino-finance/klend-sdk`](https://github.com/Kamino-Finance/klend-sdk) 7.3.22
- [`@solana/kit`](https://github.com/anza-xyz/kit) v2 (klend-sdk's runtime dependency)
- [`@solana/wallet-adapter-react`](https://github.com/anza-xyz/wallet-adapter) with Solflare as the featured wallet
- [Vercel AI SDK](https://sdk.vercel.ai/) v6 for streaming + tool orchestration
- [Anthropic Claude Sonnet 4.6](https://www.anthropic.com/) via [OpenRouter](https://openrouter.ai/) as the LLM

Full architecture diagram in [`../README.md#architecture`](../README.md#architecture).
