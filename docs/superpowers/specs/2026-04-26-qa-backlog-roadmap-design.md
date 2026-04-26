# QA Backlog Roadmap — 5-Chunk Design

**Date:** 2026-04-26
**Author:** RECTOR + CIPHER (brainstorming session)
**Status:** Approved
**Source:**
- QA report: `.qa/runs/1777171026-both-fresh+eyes/report.md`
- Umbrella issue: [#3 QA-2026-04-26](https://github.com/RECTOR-LABS/kami/issues/3)
- Child issues: [#4-#30](https://github.com/RECTOR-LABS/kami/issues?q=is%3Aopen+label%3Aqa-2026-04-26)
- Prior session handoff: `~/Documents/secret/claude-strategy/kami/session-handoff-2026-04-26-b.md`

---

## Goal

Close all **27 remaining QA-2026-04-26 backlog items** (Day 9 baseline QA run) via PR-shaped sprints, executed across **5 sessions** with `/workspace:session-handoff` between chunks for context-window management.

The C-1 wallet-not-connected cluster (PR #2 merged at `9e1c6bd`) was the precursor — it closed 5 child findings via 7 commits and proved the brainstorm → spec → plan → subagent-driven-development pipeline. This roadmap scales that approach across the remaining 27 issues.

---

## Approach: Theme-front Chunking

Sprints are grouped by shared theme + file overlap, not by strict priority. Reasoning: the C-1 sprint demonstrated that **context locality** (implementer + reviewer subagents holding the same conceptual frame) is the real quality multiplier. Pure priority ordering would scatter file overlap and break locality. File-front chunking would ignore dependencies and judging-relevance.

**Trade-off accepted:** D-13 (P0 oracle-staleness) lands in Chunk 2 instead of Chunk 1. C-3 (also P0, larger user-visible cluster) takes Chunk 1 because it sets type/error patterns that Chunks 2-4 reuse.

**Dependency chain (respected):**
- Chunk 2 sprints D-11/D-12 depend on Chunk 1 (C-3) for abort plumbing + `ToolErrorCode` types in main
- Chunks 3-5 are independent of each other and of D-11/D-12

---

## Chunk Overview

| # | Chunk Name | Sprints | Issues Closed | P0 / P1 / P2 / P3 | Effort | Session character |
|---|---|---|---|---|---|---|
| **1** | Error Visibility Foundation | 1 | #4 #5 #6 | 3 / 0 / 0 / 0 | ~6h | Full ceremony, sets reusable patterns |
| **2** | Test/Abort/Safety Extensions | 3 | #7 #12 #13 | 1 / 2 / 0 / 0 | ~8-12h | Heavy session, extends C-3 + judging-relevant |
| **3** | Streaming + Demo Polish | 3 | #8 #29 #30 | 0 / 1 / 0 / 2 | ~5-8h | LLM-touching, demo-visible |
| **4** | Server Hygiene | 4 | #10 #11 #16 #17 #20 #21 #25 #28 | 0 / 1 / 4 / 3 | ~6-10h | Backend-only, low merge-conflict risk |
| **5** | UI Polish + Trivial Sweep | 5 | #9 #14 #15 #18 #19 #22 #23 #24 #26 #27 | 0 / 2 / 2 / 3 + trivial | ~6-10h | Cosmetic, light-to-medium ceremony |

**Totals:** 16 sprints, 27 issues, ~31-50h across 5 sessions ≈ ~6-10h per chunk.

---

## Chunk 1 — Error Visibility Foundation

**Goal:** Surface server preflight errors, client 4xx errors, and abort-on-conv-switch races to the user.

| Sprint | Issues | Scope | Files | Effort | Ceremony |
|---|---|---|---|---|---|
| **1.1 — C-3** | #4 D-2, #5 D-3, #6 D-4 | Server preflight err propagation + client 4xx surfacing + abort race on conv switch/delete | `server/tools/kamino.ts:436-459`, `src/hooks/useChat.ts`, `src/hooks/useChat.test.ts` | 4-6h | **Full** |

**Reusable artifacts produced for downstream chunks:**
- `ToolErrorCode` union extended (already partially done in C-1)
- AbortController plumbing pattern in `useChat.ts` (Chunk 2 D-12 extends server-side)
- 4xx error toast/inline pattern (Chunk 5 trivial sweep may reuse for D-5)

---

## Chunk 2 — Test/Abort/Safety Extensions

**Goal:** Extend the C-3 abort plumbing through to the server, expand test coverage, and add the judging-relevant oracle-staleness gate.

| Sprint | Issues | Scope | Files | Effort | Ceremony | Deps |
|---|---|---|---|---|---|---|
| **2.1 — D-12** | #13 | Propagate `AbortSignal` from client through `api/chat.ts` → `server/chat.ts` `streamText` so server-side LLM call cancels when user navigates away | `api/chat.ts`, `server/chat.ts`, `api/chat.test.ts` | 2-4h | **Full** | C-3 |
| **2.2 — D-11** | #12 | Expand `useChat.test.ts`: streaming happy-path, abort-mid-stream, D-3 4xx surfacing, D-4 conv-switch abort, D-12 server-side cancel | `src/hooks/useChat.test.ts` | 4h+ | **Full** | C-3 + D-12 |
| **2.3 — D-13** | #7 | Oracle-staleness gate: `findYield`/`getPortfolio` flag stale reserves (klend-sdk `reserve.stale` + `lastUpdate`), surface in tool output, prompt warns judges | `server/tools/kamino.ts`, `server/prompt.ts` | 2-4h | **Full** | — |

**Risk note (D-13):** klend-sdk API for staleness is unverified — QA report flagged that `reserve.getReserveOracleStatus()` may not exist; need to confirm the on-chain signal (likely `reserve.lastUpdate` + slot-age threshold) during the D-13 brainstorm.

---

## Chunk 3 — Streaming + Demo Polish

**Goal:** Lift LLM streaming polish (paragraph breaks, list consistency, dedup pills) and add demo-visible enrichment (risk icons, market name pills).

| Sprint | Issues | Scope | Files | Effort | Ceremony |
|---|---|---|---|---|---|
| **3.1 — C-2** | #8 | Prompt audit: paragraph break before tool-result rendering + one-shot example for ordered lists. Frontend: dedup consecutive identical tool-call pills with "×2" badge | `server/prompt.ts`, `src/components/ToolCallBadges.tsx`, `src/components/ToolCallBadges.test.tsx` | 2-4h | **Full** |
| **3.2 — U-9** | #29 | Risk-level icons (Lucide React per CLAUDE.md "no Unicode emojis as icons") in yield/portfolio tables via markdown-renderer override | `src/lib/markdown-renderer.tsx`, `server/prompt.ts` (icon hint) | 2-4h | **Medium** |
| **3.3 — U-10** | #30 | Add Kamino market name pill ("Market: Main") to yield/portfolio tool outputs; prompt mentions market-switching hint | `server/tools/kamino.ts`, `server/prompt.ts` | 1-2h | **Medium** |

---

## Chunk 4 — Server Hygiene

**Goal:** Backend-only refactors — caching guards, allowlist hardening, structured logs, integration test for rate-limit edge case.

| Sprint | Issues | Scope | Files | Effort | Ceremony |
|---|---|---|---|---|---|
| **4.1 — C-4** | #16 D-8, #20 D-17, #21 D-18 | Log raw `KaminoAction` errors with request context + memoize PDA per (market, wallet) + in-flight promise guard on `getMarket` cache | `server/tools/kamino.ts:56-73`, `:116-118`, `:649-651` | 2-3h | **Medium** |
| **4.2 — C-5** | #10 D-9, #11 D-10, #25 D-21 | Random per-process token in dev (no shared `anonymous` bucket) + RPC denylist→allowlist + gate `_resetForTesting` at import time | `server/ratelimit.ts:65 + 94-97`, `server/rpc-guards.ts` | 2-3h | **Medium** |
| **4.3 — D-14** | #17 | Structured-log adapter (`level/event/...meta`) for `api/chat.ts` + `server/chat.ts`; replaces ad-hoc `console.error` with parseable JSON | `api/chat.ts`, `server/chat.ts`, new `server/log.ts` | 1-2h | **Medium** |
| **4.4 — D-25** | #28 | Integration test: empty `identify()` (missing X-Forwarded-For + no IP) → 429 wire-up correctness | `api/chat.test.ts` | 1-2h | **Light** |

---

## Chunk 5 — UI Polish + Trivial Sweep

**Goal:** Trivial doc/JSDoc/one-line sweep batched as a single PR, plus 4 cosmetic UI sprints.

| Sprint | Issues | Scope | Files | Effort | Ceremony |
|---|---|---|---|---|---|
| **5.1 — C-6** | #9 D-5, #18 D-15, #19 D-16, #22 D-20, #26 D-23, #27 D-24 | Trivial sweep batched as one PR: doc MAX_PARAMS shallow-check + NOTE on markdown pre/code gotcha + toNumber JSDoc + narrow pollSignatureStatus catch + reset-on-env-change for getRpc + drop relative `fetch('api/chat')` | `server/rpc-guards.ts`, `src/lib/markdown-renderer.tsx`, `server/tools/kamino.ts`, `src/components/SignTransactionCard.tsx`, `server/solana/connection.ts`, `src/hooks/useChat.ts:115` | 1-2h total | **Light** |
| **5.2 — U-5** | #14 | Sidebar conversation-title tooltip on hover (truncated titles get full text) | `src/components/Sidebar.tsx` | 1-2h | **Medium** |
| **5.3 — U-7** | #15 | Empty-state feature cards: clickable to seed prompt OR downgrade to non-interactive badges | `src/components/EmptyState.tsx`, `src/hooks/useChat.ts` (if clickable) | 1-2h | **Medium** |
| **5.4 — U-8** | #24 | Streaming "thinking" indicator: 3 pulsing dots before first LLM token arrives | `src/components/ChatMessage.tsx`, `src/hooks/useChat.ts` (first-token signal) | 1-2h | **Medium** |
| **5.5 — U-6** | #23 | Sidebar bulk-clear ("Clear all conversations" with confirm) + per-chat rename (double-click title → editable) | `src/components/Sidebar.tsx`, `src/hooks/useChat.ts` (rename + clearAll actions) | 2-4h | **Full** |

---

## Ceremony Taxonomy

Three levels. Reference baseline: **C-1 was Full ceremony** (7 commits across 7 subagent tasks, dedicated spec + plan docs, full reviewer pipeline).

### 🟣 Full Ceremony (6 sprints: 1.1, 2.1, 2.2, 2.3, 3.1, 5.5)

For multi-component, novel-design, or judging-relevant work.

| Step | Artifact | Reviewer |
|---|---|---|
| 1. Per-sprint brainstorm | Conversation only (`/superpowers:brainstorming`) | — |
| 2. Spec doc | `docs/superpowers/specs/YYYY-MM-DD-{sprint}-design.md` | RECTOR signs off before plan |
| 3. Plan doc | `docs/superpowers/plans/YYYY-MM-DD-{sprint}-implementation.md` | RECTOR signs off before exec |
| 4. Subagent-driven-development | 1 implementer + 1 spec-compliance reviewer + 1 code-quality reviewer **per task** | Both reviewers must pass |
| 5. TDD per task | failing test → confirm fail → implement → confirm pass → `pnpm exec tsc -b && pnpm test:run` | — |
| 6. Commit per task | HEREDOC commit message, no AI attribution | — |
| 7. PR + manual smoke | Detailed body + unchecked smoke checklist (only check after Chrome MCP verifies) | CI + Vercel preview |
| 8. Merge + post-merge smoke | `gh pr merge N --merge` (keep branch) + production verify | — |

### 🟡 Medium Ceremony (8 sprints: 3.2, 3.3, 4.1, 4.2, 4.3, 5.2, 5.3, 5.4)

For single-theme, well-bounded, low-novelty work.

| Step | Artifact | Reviewer |
|---|---|---|
| 1. Brainstorm skipped | Issue body is the spec | — |
| 2. Inline spec in PR body | "Approach + files touched + acceptance" — 200-300 words at top of PR description | RECTOR reviews PR, no separate sign-off |
| 3. TDD per item | Same TDD discipline, no subagent pipeline | — |
| 4. Commit per item | One commit per logical item (cluster sprints get 2-3 commits) | — |
| 5. Single PR for cluster | `Closes #X #Y #Z` in body | CI + Vercel preview |
| 6. Smoke if UI | Chrome MCP for UI sprints (3.2, 3.3, 5.2, 5.3, 5.4); skip for backend (4.1, 4.2, 4.3) | — |

### 🟢 Light Ceremony (2 sprints: 4.4, 5.1)

For trivial / mechanical / pure-test work.

| Step | Artifact | Reviewer |
|---|---|---|
| 1. No spec, no plan | Issue body suffices | — |
| 2. Direct branch + TDD where applicable | D-25 = pure test write (TDD). C-6 = comments + JSDoc + one-line fixes (no test for pure comments; small tests for D-15/D-16/D-5) | — |
| 3. Commits batched per item | Multi-commit PR; each commit closes one sub-item | — |
| 4. Single PR with checklist | Body lists all items closed | CI |
| 5. Verify | `pnpm exec tsc -b && pnpm test:run` | — |
| 6. No smoke | All non-UI | — |

---

## Cross-cutting Workflow (all sprints)

- Feature branch off `main`, PR to `main`, merge with `gh pr merge N --merge` (not squash, keep branch)
- Vercel auto-deploys `main` → https://kami.rectorspace.com
- Tick the matching checkbox in umbrella issue [#3](https://github.com/RECTOR-LABS/kami/issues/3) as each PR ships
- Memory updates: only when something genuinely cross-session-reusable surfaces (per `MEMORY.md` discipline — no chunk-completion noise)
- Per CLAUDE.md: one commit per logical change, no AI attribution, HEREDOC commit messages, ≥80% coverage on new files

---

## Chunk Hand-off Protocol

At end of each chunk:

1. Confirm CI green + production deployed + umbrella #3 checkboxes ticked for all sprints in the chunk
2. Run `/workspace:session-handoff` skill → save to `~/Documents/secret/claude-strategy/kami/session-handoff-YYYY-MM-DD-{letter}.md`
3. Append a one-line entry to `MEMORY.md` (chunk-completion marker — not a full memory entry)
4. Next session's starter prompt template:
   ```
   Continue Chunk N from the QA-backlog roadmap.
   Roadmap: docs/superpowers/specs/2026-04-26-qa-backlog-roadmap-design.md
   Last handoff: ~/Documents/secret/claude-strategy/kami/session-handoff-YYYY-MM-DD-{letter}.md
   FIRST ACTION: invoke /superpowers:using-superpowers, then begin Sprint N.1 brainstorm.
   ```

---

## Sanity Checks

- ✓ 16 sprints across 5 chunks (1 + 3 + 3 + 4 + 5 = 16)
- ✓ 27 issues closed (3 + 3 + 3 + 8 + 10 = 27)
- ✓ All P0s in Chunks 1-2 (C-3 in 1, D-13 in 2)
- ✓ Dependencies respected (D-11/D-12 in Chunk 2 follow C-3 in Chunk 1)
- ✓ Each chunk ≤ ~10h (fits one Claude session — matches C-1 chunk size)
- ✓ Ceremony levels assigned (6 Full / 8 Medium / 2 Light)
- ✓ Hand-off path defined (4 cycles between chunks)

---

## Out of Scope for This Roadmap

- **GTM / submission work** (Telegram compliance ping, README screenshots, demo video, Superteam submission, judging rehearsal). Per RECTOR: "tackle all QA reports first, don't worry about submission." Submission deadline 2026-05-12 acknowledged but deprioritized.
- **New QA findings** that surface during execution. Future QA runs spawn their own umbrella issue with `qa-YYYY-MM-DD` label and a fresh roadmap if scope warrants.
- **Refactors not tied to a QA finding.** Stay focused on the 27 backlog items.

---

*Bismillah. InshaAllah this 5-chunk plan ships all 27 with the same quality bar as C-1.*
