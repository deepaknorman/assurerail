# AssureRail Brand

Visual identity for **AssureRail** (assuretok.com) — a securitisation and
tokenisation venue: verified loan pools become compliance-gated AssurePool
Notes that settle atomically (DvP, e-Rupee) under continuous surveillance.

This is regulated capital-markets infrastructure. The identity must always read
as **trustworthy, precise, institutional, calm, permanent** — in the company of
Euroclear, DTCC, and ICE, never in the company of crypto startups.

Expanded guideline: `docs/design/AssureRail_Brand.md`.

## Files

| File | Purpose |
|---|---|
| `logo.svg` | Primary horizontal lockup (mark + wordmark), theme-aware |
| `logo-mark.svg` | The Interlock mark alone — app icon, avatar, stamps |
| `favicon.svg` | Full-bleed simplified mark, legible at 16 px, theme-aware |
| `tokens.css` | Full colour/type/shape token system, light + dark |
| `fonts.md` | Google Fonts pairing, loading snippets, usage rules |

## The mark: the Interlock

Two congruent pieces — the **asset leg** (ink) and the **payment leg**
(verdigris) — machined to fit one another in exactly one way. Joined, they
complete a single sealed square: the pool, the note, the settled trade. The
stepped seam is the moment of atomic settlement: **neither piece means anything
alone, and once joined they cannot separate without visible breakage** — that
is delivery-versus-payment, and that is tamper-evidence, in one gesture.

The same stepped seam appears in the wordmark as the angular spine of the
s — the signature letter of A**ss**ureRail.

No coins, no chains, no cubes, no glows. The mark is a seal, not a badge.

## Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| Harbour 800/600 | `#0E2836` / `#164B5F` | — | Brand ink, primary actions (light) |
| Verdigris 600/400 | `#157A63` | `#4EC9AB` | The single accent: settlement moments, links (dark), the payment leg |
| Slate 0–950 | `#FFFFFF`…`#0F1922` | — | Neutral scale |
| Dark surfaces | — | `#0B141C` page, `#101C26` surface, `#16242F` raised | Trading-desk dark UI |
| Success / Warning / Error / Info | `#1C7A46` / `#8A5A12` / `#B42B3A` / `#1F5F9E` | `#57C98B` / `#E3B25E` / `#EE7C86` / `#7CB5EA` | Status text-grade |

Rules:
- Verdigris is **scarce**. It marks settlement, confirmation, and the payment
  leg — one accent moment per view. If a screen is more than ~5% verdigris,
  remove some.
- Never place harbour text on verdigris or vice-versa at body sizes.
- All text uses the semantic tokens in `tokens.css`; every pair is WCAG AA
  (ratios documented in the expanded guideline). `--arail-text-muted` in light
  theme is large/decorative text only.

## Logo usage

Do:
- Use `logo.svg` on marketing and documents; `logo-mark.svg` where space is square.
- Clear space: half the mark's height on all sides. Minimum sizes: lockup
  120 px wide; mark 20 px; favicon variant below that.
- Recolour via CSS vars when inlined: `--arail-logo-ink`, `--arail-logo-accent`
  (already set per theme by `tokens.css`). For strict monochrome, set both to
  `currentColor`.

Don't:
- Don't rotate, outline, shadow, gradient-fill, or animate the mark.
- Don't recolour the accent piece to anything but verdigris (or the shared
  monochrome colour).
- Don't set the wordmark in a font — it is drawn lettering; use the SVG.
- Don't place the logo on photography or busy backgrounds.
- Don't attach it to coins, cubes, chains, circuits, or glowing anything.

## Voice

Declarative, exact, unhurried. Say *issue, register, gate, settle, surveil* —
the vocabulary of market infrastructure. Never *mint, on-chain, web3, crypto,
revolutionary*. Numbers do the persuading; set them in IBM Plex Mono:

> Pool `AL-2027-014` settled DvP at `14:32:07 IST`. 4,182 underlying loans.
> Surveillance: continuous.

## Using the tokens

```tsx
// app/layout.tsx
import "@/../apps/assurerail/brand/tokens.css"; // or copy into app/styles
// fonts: see fonts.md (next/font wiring)
<body className="arail">…</body>
```

Theme switching: set `data-theme="dark"` or `data-theme="light"` on `<html>`;
with neither attribute the OS preference applies. Components must consume only
semantic tokens (`--arail-bg-*`, `--arail-text-*`, `--arail-action-*`), never the
raw Harbour/Verdigris/Slate primitives.
