# Kami Landing — Bento + Amber Design Spec

**Date:** 2026-04-28
**Author:** RECTOR + CIPHER
**Status:** Approved (pending implementation plan)
**Related:** PR #42 (README rewrite), Eitherway Track Frontier 2026 bounty (deadline 2026-05-12)

---

## 1. Goal

Replace the current minimal `EmptyState.tsx` (gradient K logo + "Welcome to Kami" + 4 feature cards + Connect with Solflare CTA) with a **richer pre-connect landing experience** in a bento-grid layout using an amber-on-sepia palette. The landing should feel like a confident production AI/DeFi product — not a scaffolded hackathon empty state — and earn a strong first impression from bounty judges browsing `kami.rectorspace.com` before they connect a wallet.

## 2. Why

- The current empty state is informationally thin (4 generic feature cards + Connect CTA).
- Bounty judges score live dApp working + UX quality; a polished pre-connect surface is high-leverage signal.
- README rewrite (PR #42) gave Kami strong GitHub-side marketing; the live URL needs equivalent polish for visitors who land directly.
- The aidesigner-generated v3 prototype validated the direction — bento grid + amber palette + chat/AI-native vocabulary. RECTOR signed off on v3 (this spec captures that decision).

## 3. Visual identity

### 3.1 Color palette (A3 — amber on sepia)

| Token | Hex | Usage |
|------|------|-------|
| `kami-bg` | `#1a1410` | Body background. Warm sepia. |
| `kami-cell-base` | `#221a14` | Default bento cell background (slightly elevated from body). |
| `kami-cell-elevated` | `#2a2117` | Hover state for cells; also the more-elevated variant. |
| `kami-text` | `#F5E6D3` | Primary text (cream). |
| `kami-text-muted` | `rgba(245, 230, 211, 0.6)` | Secondary text, mono labels. |
| `kami-border` | `rgba(245, 230, 211, 0.12)` | Hairline cell borders. |
| `kami-amber` | `#FFA500` | Accent: CTA, data emphasis, cursor blink, hover-border, sponsor highlight. |
| `kami-amber-glow` | `rgba(255, 165, 0, 0.15)` | Drop-shadow on hover. |
| `kami-amber-15` | `rgba(255, 165, 0, 0.05)` | Ambient bg blur tint. |

Solana brand semantics: amber `#FFA500` is close to (but not identical to) Solflare's `#FCA311`. The visual closeness lets the Connect CTA stay on-brand for Solflare without a separate brand color. Direct Solflare reference (e.g., wallet adapter logo) keeps the canonical Solflare orange `#FCA311`; everything else uses Kami amber `#FFA500`.

### 3.2 Typography

| Family | Source | Usage |
|--------|--------|-------|
| **Unbounded** (700/800) | Google Fonts | Display headline (`Type. Sign. Done▌`) and section headers. Geometric, distinctive. |
| **Inter** (400/500) | Google Fonts | Body text. Already in Kami stack. |
| **JetBrains Mono** (400/500/700) | Google Fonts | All technical / data text: addresses, signatures, stat keys, tool names, label overlines, `> ` prompts, code references. |

Drop the Bricolage Grotesque face that aidesigner included in v2 — Unbounded covers the display role; Inter handles everything else; mono covers data. Three families is enough.

### 3.3 Animation

- **`▌` cursor blink** — 1s `step-end infinite` opacity flip, amber color. Anchored to the end of the hero headline (`Done▌`).
- **Pulse-dot** — `box-shadow` 2s ease-out infinite, on the `[sys.status: online]` indicator dot in the header.
- **Cascade-up entrance** — cells animate in from `translateY(20px) opacity:0` over 800ms with `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (gentle bounce). Staggered 100ms between cells (`--delay: 1, 2, 3, …`). Total stagger ~1.0s.
- **Hover lift** — cells `-translate-y-[2px]`, border shifts from `cream-border` to `amber/40`, drop-shadow `0_10px_40px_-20px_rgba(255,165,0,0.15)`, transition 500ms `cubic-bezier(0.4, 0, 0.2, 1)`.
- **No parallax / scroll-triggered animations**. Keep it static after entrance.

### 3.4 Background

- Body: warm sepia `#1a1410` with a 32px grid pattern at `rgba(245, 230, 211, 0.03)` opacity (subtle structural feel, not noise).
- Single ambient amber blur (600px diameter, `120px` blur, `5%` opacity) anchored at top-left for warmth.
- No gradients, photos, illustrations, or video.

## 4. Layout

12-column bento grid, max-width 1280px. On `lg:` breakpoint and up, the structure is:

```
┌──────────────────────────────────────────┬───────────────────┐
│                                            │                   │
│   HERO CELL                                 │   SYS.METRICS     │
│   (col-span-8, row-span-2, ~480-560px tall) │   (col-span-4)    │
│                                            │                   │
│                                            ├───────────────────┤
│                                            │                   │
│                                            │   LOG.LATEST_TX   │
│                                            │   (col-span-4)    │
│                                            │                   │
├──────────┬──────────┬──────────┬───────────┴───────────────────┤
│          │          │          │                               │
│ tool/A   │ tool/B   │ tool/C   │ tool/D                        │
│ (3 cols) │ (3 cols) │ (3 cols) │ (3 cols)                      │
├──────────┴──────────┴──────────┴───────────────────────────────┤
│                                                                 │
│   PIPELINE                                                      │
│   (col-span-12, dashed-border, [1/3] → [2/3] → [3/3])           │
├─────────────────────────────────────────────────────────────────┤
│   SPONSOR STRIP — Eitherway · Kamino · Solflare · Helius · ...  │
└─────────────────────────────────────────────────────────────────┘
```

**Header overline** above the grid: `> KAMI · v1.0 · MAINNET` left, `[sys.status: online] •` (pulsing amber dot) right.

**Mobile** (`< md:`): all cells stack vertically full-width. The hero cell loses its 2-row span. The 4 tool cells become a 2x2 grid on `md:` then full-stack on smaller screens. The pipeline cell's 3 steps stack vertically with `→` arrows between.

## 5. Cell-by-cell content

### 5.1 HERO cell

Top section (vertically anchored top):
- Environment chip: `[code-icon] env / mainnet-beta` — small mono chip, sepia-900 bg, cream-border outline.
- Headline (Unbounded display, clamp 5xl→7xl→[5rem]):

  ```
  Type. Sign.
  Done▌
  ```

  The `▌` is the blinking amber cursor.

- Subhead (Inter body, lg→xl):

  > Speak plain English. Kami parses your intent, calls Kamino `klend-sdk` primitives, and queues a mainnet transaction. No dashboard scraping required.

  `klend-sdk` rendered as inline mono in amber.

Bottom section (vertically anchored bottom, separated by a `border-t border-cream-border/50` rule):
- Left: a fake "Agent Input" mono prompt field — `> find best USDC yield` — that visually echoes the chat input the user will get post-connect.
- Right: CTA button. **Label: `Connect with Solflare`** (NOT v3's `Init Session`; revert to the Solflare-explicit naming for sponsor alignment). Wallet icon (Phosphor `ph-wallet` or Lucide `Wallet`), uppercase mono, amber bg, sepia-900 text, rounded-xl, hover scales/changes bg slightly.

### 5.2 `sys.metrics` cell (top-right)

- Header row: `[cpu-icon] sys.metrics` (mono label, cream-muted color).
- 4 metric rows, each a flex `justify-between` line, mono text, `border-b cream-border/20` between them:

| Key | Value | Notes |
|---|---|---|
| `sys.tools_loaded` | `7 active` | amber color (it's the proudest stat) |
| `ci.tests_passing` | `186 suite` | cream (high contrast but not amber — keep amber sparing) |
| `net.roundtrips` | `3 mainnet` | cream |
| `sys.genesis` | `2026-04-19` | cream |

Hover on each row: value translates `+1px` right.

### 5.3 `log.latest_tx` cell (bottom-right)

Slightly more elevated bg than other cells (`sepia-900/30`) so it reads as a featured proof-of-life.

- Header row: `[arrows-icon] log.latest_tx` left, `[check-icon] Confirmed` chip right (amber-tinted bg, amber-bordered, amber text, mono uppercase).
- Body: a nested card (`sepia-800` bg + `cream-border`) containing two stacked field-value pairs separated by a horizontal rule:
  - `Signature` → `5XKeETjGfm…UpvZE` mono cream link with `↗` external-link icon. Links to Solscan.
  - `Action` → bullet (amber dot) + `5 USDC supplied to Kamino` body text.

Use the actual Day-6 mainnet signature `5XKeETjGfmj9jEWUNCKcf8u49bY4hEzX2a7JcB4nPxQCBbmZ7ipoNrgTXQMJWXHvKw7Bsera9xxYygLVxLUpUvZE` (already cited in README's Proof of Life section + `docs/kamino-integration.md`).

### 5.4 Tool cells (×4)

Each cell renders one Kamino tool. **Pick the four most demoable tools** (skip the `build*` cousins to avoid repetition):

| Cell | Display name | Description (1 line) | Implementation hint (mono small) |
|---|---|---|---|
| 1 | `tool/findYield` | Scans Kamino reserves for highest supply / borrow APY. | `→ KaminoMarket.reserves` |
| 2 | `tool/getPortfolio` | Fetches connected wallet's positions, debt, health factor. | `→ KaminoMarket.getObligationByAddress` |
| 3 | `tool/simulateHealth` | Projects post-action health factor before signing. | `→ Obligation.simulateBorrowAndWithdrawAction` |
| 4 | `tool/buildSign` | Builds + signs deposit / borrow / withdraw / repay v0 transactions. | `→ KaminoAction.build*Txns` |

`tool/buildSign` is a generic umbrella for the 4 `build*` Kamino tools. The detail "4 build variants" is exposed in `docs/kamino-integration.md` and can be teased in a tooltip on hover; the landing keeps the count clean at 4 cells.

Each cell layout:
- Top: `[folder-icon] tool/<name>` mono amber.
- Middle: 1-line description in cream/80.
- Bottom: implementation hint mono in `cream-muted` inside a small bordered chip.

Hover: the chip border turns amber.

### 5.5 PIPELINE cell

Full-width, 2px-dashed border (visually distinct from the solid-bordered cells), interior padding generous.

3-step horizontal flow with a horizontal track-line behind (`1px` solid `kami-border` running across the cell at vertical center):

| Step | Label | Icon |
|---|---|---|
| `[1/3]` | `INTENT` | `[terminal-window]` amber |
| `[2/3]` | `SIGNATURE` | `[pen-nib]` amber |
| `[3/3]` | `EXECUTION` | `[check-circle]` amber |

Each step sits on a sepia-800 bg "card" that breaks the track-line where it crosses, giving the visual impression of stepping stones across a wire.

Hover on each step: bracket numeral turns amber.

### 5.6 SPONSOR strip

Full-width, `py-8`, no border. Initial state `opacity-50` + `grayscale`. On hover (entire strip): grayscale removes, opacity full, 500ms transition.

Wordmarks (text only, no logo files): `Eitherway · Kamino · Solflare · Helius · Vercel`. Display font (Unbounded), uppercase, tracking-widest, separated by amber dots (`amber/40` color).

Note: in v3 aidesigner included Anthropic but I removed it here — Anthropic powers the LLM but isn't a bounty-track sponsor; keeping the list aligned with the README's bounty acknowledgments.

### 5.7 Footer (no change pre-connect)

Today's pre-connect view (`EmptyState.tsx`) does NOT show a disclaimer footer — the disclaimer ("Kami provides information only. Always verify before signing transactions.") lives below `ChatInput`, which only renders post-connect. The bento landing preserves this: no disclaimer footer pre-connect (there's nothing to sign yet). After-connect, the existing disclaimer stays unchanged in this spec; restyle to amber lands in the chat-shell follow-up spec.

## 6. Implementation strategy

### 6.1 Where the bento landing lives

`src/components/EmptyState.tsx` is the entry point. Today it returns a `<div>` with the K logo, heading, 4 feature cards, and Connect CTA. **The new bento landing fully replaces this component's body**.

The bento renders only when `connected === false` (existing condition; preserved). When `connected === true`, the chat shell (ChatPanel + Sidebar + ChatInput + ChatMessage) takes over — same as today. **The chat surfaces themselves are NOT redesigned in this spec** (separate scope, separate spec if needed).

### 6.2 Tailwind theme additions

Update `tailwind.config.ts` `theme.extend.colors` with the new tokens (kami-bg, kami-cell-base, kami-cell-elevated, kami-text, kami-text-muted, kami-border, kami-amber, kami-amber-glow). Keep existing `kami-accent` purple for backward compatibility during the transition; mark it deprecated in a comment and remove in a follow-up after the chat shell is also restyled (out of scope for this spec).

Add `theme.extend.fontFamily`:
- `display: ['Unbounded', 'sans-serif']`
- `mono: ['JetBrains Mono', 'monospace']` (overrides Tailwind's default mono stack)

Add `theme.extend.transitionTimingFunction`:
- `'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'`
- `'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)'`

Add the `cascade-up`, `blink`, and `pulse-dot` keyframes to `tailwind.config.ts` `theme.extend.keyframes` + `animation` (proper Tailwind plugin form, NOT inline `<style>` tags — we're shipping React, not the prototype HTML).

### 6.3 Font loading

Add Google Fonts `<link>` tags to `index.html` for Unbounded (700/800) and JetBrains Mono (400/500/700). Inter is already loaded.

### 6.4 Icons

Kami already uses **Lucide React** (`lucide-react` package). v3 prototype uses **Phosphor Icons** because aidesigner picked it. **For the React port, use Lucide equivalents** — keep the dep tree clean.

| Phosphor (v3) | Lucide React (port) |
|---|---|
| `ph-code` | `Code2` |
| `ph-cpu` | `Cpu` |
| `ph-arrows-left-right` | `ArrowLeftRight` |
| `ph-folder-open` | `FolderOpen` |
| `ph-terminal-window` | `Terminal` |
| `ph-pen-nib` | `PenLine` |
| `ph-check-circle` | `CheckCircle2` |
| `ph-check` (in Confirmed pill) | `Check` |
| `ph-arrow-up-right` | `ArrowUpRight` |
| `ph-wallet` (CTA) | `Wallet` |
| `ph-arrow-right` (mobile pipeline) | `ArrowRight` |

### 6.5 Component decomposition

Split `EmptyState.tsx` into smaller components for clarity:

- `EmptyState.tsx` — top-level layout + the bento grid.
- `BentoCell.tsx` — shared cell wrapper with hover, cascade animation, border + bg styling. Takes `delay`, `className`, `children` props.
- `HeroCell.tsx` — the big hero cell content (env chip, headline, subhead, mock prompt, CTA).
- `SysMetricsCell.tsx` — the 4-row stats list. Takes `metrics` prop (key/value/highlight tuples).
- `LatestTxCell.tsx` — the proof-of-life card. Takes `signature`, `action`, `solscanUrl` props.
- `ToolCell.tsx` — single tool. Takes `name`, `description`, `hint`, `icon` props. Used 4 times.
- `PipelineCell.tsx` — the 3-step strip. Static content.
- `SponsorStrip.tsx` — wordmarks. Static.
- `KamiCursor.tsx` — `<span class="cursor-blink">▌</span>` extracted as a tiny component for reuse (will also appear in chat input post-connect, in a follow-up).

The cascade animation delay is sequenced at the bento grid level (each cell receives a `delay` prop 1..10), keeping the animation choreography in one place.

### 6.6 Hardcoded vs dynamic data

- **Hardcoded for v1**: `sys.metrics` values (7 / 186 / 3 / 2026-04-19), the latest tx signature + action, sponsor list.
- **Dynamic deferred**: dynamic test count, dynamic latest mainnet tx (read from a future mainnet activity log endpoint), dynamic uptime. None of this exists yet; spec it as future work.

The hardcoded values must match the README + integration docs. Centralize them in a `src/lib/landing-content.ts` constants file so future updates touch one place.

## 7. Out of scope

This spec covers the **pre-connect landing block only**. Explicitly NOT in scope:

- Chat shell redesign (ChatPanel, Sidebar, ChatInput, ChatMessage, SignTransactionCard) — they keep their current purple `kami-accent` styling. A follow-up spec will redesign the chat shell to match the amber palette so the post-connect experience cohereres with the landing.
- Mobile sidebar redesign.
- Animation choreography between landing → chat (e.g., the bento collapsing as the wallet connects). For v1, the page simply re-renders into the chat shell — no transition.
- Theme switcher (light mode). Dark only.
- Marketing logos for sponsors. Text wordmarks only.
- Dynamic stats / latest tx fetching. Hardcoded for v1.
- Internationalization. English only.

## 8. Open questions / decisions during implementation

1. **CTA copy** — final call: `Connect with Solflare` (sponsor-aligned, recommended) vs `Init Session` (chat/AI native, what v3 used). Spec recommends `Connect with Solflare`; flag if RECTOR prefers `Init Session`.
2. **Cell border-radius** — v3 uses `1.5rem` (lg+) / `2rem`. Confirm or tighten to a more conservative `0.75rem` for less "rounded modern" feel.
3. **Latest tx solscan URL** — confirm the Day-6 deposit `5XKee...UpvZE` is the right showcase tx (vs the deposit→repay→withdraw round-trip ones in `docs/kamino-integration.md` Hero Moment section).
4. **Tool cell hint format** — "→ klend.getReserves()" style (v3) vs "klend.getReserves()" without the arrow vs "import { KaminoMarket } from '@kamino-finance/klend-sdk'" full import. Spec says go with the short arrow form.
5. **Sponsor link on click** — v1 leaves them as text-only (no anchor). Add anchor links to each sponsor's site (eitherway.ai, kamino.finance, solflare.com, helius.dev, vercel.com)?

## 9. Success criteria

- Visitor lands on `kami.rectorspace.com` (not connected), sees the bento landing, immediately understands "this is an AI co-pilot for Kamino on Solana that produces signed mainnet transactions."
- All 4 tool cells visually communicate the tool's purpose without requiring the visitor to click anything.
- The CTA path (Connect with Solflare → wallet popup → connected → chat shell) works identically to today; no auth regression.
- Mobile (375px width) renders without horizontal scroll, all cells stack cleanly.
- Lighthouse performance ≥ 90 (the landing block adds Google Fonts + ~200 lines of JSX; no large bundles).
- Tests: `EmptyState.tsx` regression tests pass; new tests for `HeroCell.tsx` (CTA fires onConnect), `LatestTxCell.tsx` (renders signature + opens Solscan), `ToolCell.tsx` (all 4 instances render their props correctly).
- All existing tests stay green (186 → 186+).
- No new ESLint warnings.
- Accessibility: every interactive element keyboard-navigable; `aria-label` on icon-only buttons; color contrast meets WCAG AA on amber-on-sepia for both primary and disabled states.

## 10. Estimated implementation effort

- Tailwind theme + font loading: ~30 min.
- 7 new components (BentoCell + HeroCell + SysMetricsCell + LatestTxCell + ToolCell + PipelineCell + SponsorStrip): ~3-4 hours.
- Refactor `EmptyState.tsx` to use the new components: ~30 min.
- Tests: ~1-2 hours (5 new test files, ~10-15 new test cases).
- QA pass + mobile responsive fixes: ~30 min - 1 hour.
- Total: **5-7 hours** of implementation work, post-spec.

## 11. References

- aidesigner v3 prototype HTML: `.superpowers/brainstorm/50873-1777364130/content/design-v3.html` (run_id `dc556226-35e4-477b-be6a-4bfbcf5087af`)
- Earlier iterations:
  - v1 (osovault DNA, too-similar): run_id `1c4e9ca0-6f95-4f9b-a448-5f4ea05c37a6`
  - v2 (vocabulary refresh, structurally still osovault): run_id `2af3542b-909b-40a7-8b6c-540ae67ccfa5`
- Layout decision: bento grid (vs conversation-first vs IDE) — RECTOR picked bento.
- Palette decision: A3 amber on sepia (vs original osovault yellow, electric yellow, mustard, neon, etc.) — RECTOR picked A3.
- Inspiration site: osovault.xyz (DNA, NOT structural copy)
- Total aidesigner credits spent during exploration: 3 (1c4e9ca0 + 2af3542b + dc556226). Remaining balance: 74.
