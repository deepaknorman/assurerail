# AssureRail — Brand Identity Guideline (Expanded)

**Status:** v1.0 — July 2026
**Assets:** `apps/assuredst/brand/` (`logo.svg`, `logo-mark.svg`, `favicon.svg`, `tokens.css`, `fonts.md`, `README.md`)
**Domain:** assuretok.com

---

## 1. What AssureRail is, and what the identity must do

AssureRail is a **securitisation and tokenisation venue** — capital-markets
infrastructure. It takes a bank's or NBFC's verified loan pool and turns it
into a compliance-gated, tradeable, tokenised instrument (an **AssurePool
Note**) that settles **atomically** — delivery-versus-payment in e-Rupee — and
remains under continuous, tamper-evident surveillance.

The audience is exclusively institutional: banks, NBFCs, institutional
investors, trustees, and regulators (RBI / SEBI / IFSCA). The identity is a
prerequisite for those conversations. It must signal, before a word is read:

- **Permanence** — this venue will exist in thirty years.
- **Precision** — nothing here is approximate; settlement is binary.
- **Calm** — no urgency, no hype, no growth-hacking.
- **Sophistication** — the reference class is Euroclear, DTCC, ICE, a Bloomberg
  Terminal — never a crypto startup.

One line captures the positioning: **programmable trust for capital markets.**

### Standalone by design

AssureRail is a standalone brand. It deliberately shares no mark, palette,
lettering, or layout DNA with any parent or sibling product, and it must never
be presented as a skin of one. (Public-facing surfaces also never name the
underlying ledger technology — the phrase is "immutable registry
infrastructure".)

---

## 2. Directions explored, and the one chosen

Three directions were developed before committing:

1. **Registry Grid** — a fine-ruled square with a single filled cell: a
   register entry. Institutional, but generic; indistinguishable from a dozen
   data-infrastructure brands, and it says *record* without saying *exchange*.
2. **Tranche Pool** — a circle stratified into horizontal bands inside a seal
   ring: a pool cut into tranches. Accurate to securitisation, but the
   silhouette collapses into the database-cylinder cliché at small sizes, and
   it says *structure* without saying *settlement*.
3. **The Interlock** — a solid square split by a precise stepped seam into two
   congruent counterpart pieces. **Chosen.** It is the only direction that
   captures the venue's defining act — two legs exchanging in one motion — and
   it survives at 16 px.

## 3. The mark: the Interlock

### Meaning

Two congruent pieces — rotationally symmetric, machined to fit one another in
exactly one way:

- the **asset leg** (ink) — the verified loan pool, delivered;
- the **payment leg** (verdigris) — e-Rupee, paid.

Joined, they complete one sealed square: the AssurePool Note, the settled
trade, the closed register. The stepped seam between them is the venue's
entire proposition in one gesture:

- **Atomic settlement** — neither piece is meaningful alone; the square exists
  only when both legs are present. Delivery *versus* payment.
- **Compliance gating** — the pieces fit only one way. A leg that doesn't
  conform doesn't join.
- **Tamper evidence** — once joined, the pieces cannot separate without
  visible breakage along the seam. Surveillance is not an add-on; it is the
  geometry.

The square itself carries the older institutional meanings: the vault, the
seal, the ledger cell, certainty.

### Construction (for reproduction)

On a 64-unit grid: a 48-unit square (8,8)–(56,56) divided by a stepped seam of
constant 4-unit width. Seam centreline: enter the top edge at x = 40, descend
to y = 26, step left to x = 32, descend to y = 38, step left to x = 24, exit
the bottom edge. The two resulting pieces are congruent under 180° rotation
about the centre — an equal exchange, literally. Exact paths:

```
ink (asset leg):      M22 56 H8  V8  H38 V24 H30 V36 H22 Z
verdigris (payment):  M42 8  H56 V56 H26 V40 H34 V28 H42 Z
```

The favicon variant (`favicon.svg`) is the same geometry taken full-bleed
(square 4–60) with the seam widened to 6 units so the keyway renders ~1.5 px
at a 16 px tab size.

### Mark rules

- The ink piece is always top-left, the verdigris piece bottom-right. Never
  swap, mirror, or rotate — the orientation is part of the mark.
- Monochrome contexts (engraving, embossing, single-colour print, watermarks):
  both pieces in one colour; the seam alone carries the idea. Set
  `--arail-logo-ink` and `--arail-logo-accent` to the same value (or
  `currentColor`).
- Never: outlines, drop shadows, gradients, glows, 3-D extrusion, animation of
  the pieces separating (the pieces *never* separate — that is the point),
  containment in circles or rounded squares, pattern tiling at low opacity
  above 4% tint.

## 4. The wordmark

"AssureRail" is **drawn lettering, not a font** — engineered monoline forms on
the same grid as the mark (stroke 4, cap height 29, x-height 21, generous
tracking). It ships only as paths inside `logo.svg`, so the logo is fully
self-contained with no font dependency, and it cannot drift when system fonts
change.

The signature detail: **the s is the seam.** The angular meander spine of
the two lowercase s's is the same stepped channel that divides the mark,
finished with short inward terminal hooks for legibility. The wordmark and
the mark are one system — "A**ss**ure" literally carries two seams.

Case: "Assure" + "Rail". The gap before "R" is slightly widened (9 units vs
7) to let the compound read without a colour change — the wordmark is always
a single colour (ink, or the theme's logo ink).

Suggested gloss when the name must be explained: *Rail — the settlement rail
from verified pool to atomic DvP.*

Wordmark rules: never re-set the name in Archivo or any font in logo
contexts; never letter-space, stretch, or weight-shift the supplied paths;
in running text write "AssureRail" (one word, two capitals).

## 5. Colour system

### Core

| Name | Hex (light role) | Hex (dark role) | Meaning |
|---|---|---|---|
| **Harbour** (petrol blue scale, 50–950) | ink `#0E2836`, action `#164B5F` | surfaces are harbour-tinted near-blacks | Deep water, deep draft: stability, depth, quiet authority. The brand core. |
| **Verdigris** (settlement accent, 50–900) | `#157A63` | `#4EC9AB` | The patina bronze earns by lasting. The single accent: settlement, confirmation, the payment leg. |
| **Slate** (neutral scale, 0–950) | `#FFFFFF`–`#0F1922` | — | Cool, faintly petrol-tinted neutrals; never warm greys. |

Why not the usual banker navy-plus-gold: navy/gold says *private wealth*;
harbour/verdigris says *engineered permanence* — closer to precision
instrument than premium card. And a green-teal accent gives the dark theme a
confirmation colour that reads as "settled" without borrowing crypto neon —
verdigris at 400 is precise, not luminous.

### Dark theme (primary product theme)

The venue UI is a trading-desk surface; dark is not an afterthought, it is the
default working environment. Surfaces are harbour-tinted, never pure black:
page `#0B141C`, surface `#101C26`, raised `#16242F`, borders `#23343F` /
`#334855`. Text `#E8EEF3` / `#A9BAC6` / `#7C909D`. Interactive and accent
collapse to verdigris-400 with harbour-950 label text.

### Semantic status

| Status | Light text | Dark text | Notes |
|---|---|---|---|
| Success | `#1C7A46` | `#57C98B` | Settlement confirmed; distinct from Verdigris (accent ≠ status) |
| Warning | `#8A5A12` | `#E3B25E` | Surveillance advisories, expiry windows |
| Error | `#B42B3A` | `#EE7C86` | Failed gates, breached covenants |
| Info | `#1F5F9E` | `#7CB5EA` | Notices, regulator bulletins |

Each has paired `-bg` and `-border` tokens in both themes (see `tokens.css`).

### Measured contrast (WCAG 2.x)

| Pair | Ratio | Grade |
|---|---|---|
| Text primary `#0F1922` on white | 16.8:1 | AAA |
| Text secondary `#40525F` on white | 8.1:1 | AAA |
| Link / action `#164B5F` on white | 9.5:1 | AAA |
| Accent text `#157A63` on white | 5.3:1 | AA |
| Success `#1C7A46` / Warning `#8A5A12` / Error `#B42B3A` / Info `#1F5F9E` on white | 5.4 / 5.9 / 6.3 / 6.6 | AA+ |
| Dark: text `#E8EEF3` on `#0B141C` | 15.9:1 | AAA |
| Dark: secondary `#A9BAC6` on `#0B141C` | 9.5:1 | AAA |
| Dark: link/accent `#4EC9AB` on `#0B141C` | 9.2:1 | AAA |
| Dark: `#4EC9AB` on raised `#16242F` | 7.7:1 | AAA |
| Dark: status `#57C98B` / `#E3B25E` / `#EE7C86` / `#7CB5EA` on `#0B141C` | 9.1 / 9.7 / 7.1 / 8.7 | AAA |
| Button: white on `#164B5F` | 9.5:1 | AAA |
| Button: white on `#157A63` | 5.3:1 | AA |
| Button (dark): `#071219` on `#4EC9AB` | 9.2:1 | AAA |

Exception: light-theme `--arail-text-muted` (`#748895`, 3.7:1) is reserved for
large (≥19 px) or decorative text only.

### Colour discipline

- Verdigris is scarce by rule: one accent moment per view. It marks the
  settlement action, the confirmed state, the payment leg — nothing else.
- Data visualisation: build ramps from Harbour and Slate; Verdigris only for
  the "settled/confirmed" series; status colours only with status meaning.
- Never gradients in brand surfaces. Flat colour is the point.

## 6. Typography

Full detail and loading snippets: `apps/assuredst/brand/fonts.md`.

- **Archivo 500/600/700** — display and headings. Archival grotesque; squared
  terminals echo the mark's machining.
- **Inter 400/500/600** — body and UI; tabular figures for aligned columns.
- **IBM Plex Mono 400/500/600** — every value with settlement meaning: pool
  serials, token IDs, hashes, ISINs, ledger amounts, timestamps. Institutional
  mono (IBM heritage), unambiguous `0/O` and `1/l/I`.

The type scale, weights, tracking, and numeric feature tokens are defined in
`tokens.css` (`--arail-text-*`, `--arail-leading-*`, `--arail-weight-*`,
`--arail-tracking-*`, `--arail-numeric-tabular`).

The mono is a positioning instrument, not a garnish: a screen where
`AL-2027-014` and `14:32:07 IST` are set in Plex Mono against calm Inter prose
reads as a terminal for professionals — precisely the Bloomberg-adjacent
signal intended.

## 7. Voice and tone

- **Declarative.** "Pool AL-2027-014 settled DvP at 14:32:07 IST." Not "Your
  pool has been successfully settled!"
- **Market-infrastructure vocabulary:** issue, register, gate, list, settle,
  surveil, attest, redeem. **Banned vocabulary:** mint, on-chain, web3,
  crypto, token economy, revolutionary, disrupt, seamless, supercharge.
- **Numbers persuade; adjectives don't.** Prefer a figure in mono to a claim
  in bold.
- **Calm under failure.** Error copy states what gate failed and what happens
  next; no exclamation marks anywhere in the product, ever.
- Regulator-facing materials use the same voice — the brand does not have a
  "sales register" and a "compliance register"; it has one register.

## 8. Application notes

- **Venue UI (dark):** page `#0B141C`; panels `#101C26`; the logo in
  `--arail-logo-ink` `#E8EEF3` + verdigris-400. Density is a feature — 13 px
  Inter, 11–12 px Plex Mono in read-only registers, tabular figures always.
- **Documents / term sheets (light):** white page, harbour ink, one verdigris
  moment (e.g. the settlement attestation line). Archivo 600 titles, Inter
  body, Plex Mono schedules.
- **Decks for banks/regulators:** white or harbour-950 slides only. The mark
  may sit large and alone on section dividers; never decorate it.
- **Favicon/app icon:** `favicon.svg` (theme-aware). For platforms needing
  raster, export at 16/32/180/512 from `favicon.svg`, not from `logo-mark.svg`.
- **Co-branding (lender portals):** AssureRail lockup at equal or smaller size
  than the partner mark, separated by a 1 px slate rule; never merge marks.

## 9. Logo do's and don'ts (summary)

Do: use supplied SVGs; keep clear space of half the mark height; minimum
120 px lockup / 20 px mark; recolour only via `--arail-logo-ink` /
`--arail-logo-accent`; monochrome via `currentColor`.

Don't: rotate, mirror, outline, shadow, gradient, glow, extrude, animate the
seam apart, re-set the wordmark in a font, place on photography, or pair with
coins/chains/cubes/circuit imagery.

## 10. Token architecture (engineering)

`apps/assuredst/brand/tokens.css`:

- **Primitives** (`--arail-harbour-*`, `--arail-verdigris-*`, `--arail-slate-*`)
  are theme-invariant and must not be consumed by components.
- **Semantic tokens** (`--arail-bg-*`, `--arail-text-*`, `--arail-border-*`,
  `--arail-action-*`, `--arail-{success,warning,error,info}-*`,
  `--arail-logo-*`) are the component API and switch with theme.
- Theming: `:root` light; `[data-theme="dark"]` explicit dark;
  `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`
  for OS preference; `color-scheme` is set so native controls follow.
- The SVG logos carry their own light/dark fallback (`prefers-color-scheme`
  inside the file) for `<img>`/standalone use, and defer to
  `--arail-logo-ink`/`--arail-logo-accent` when inlined — which `tokens.css`
  defines per theme, so inlined logos always match the app theme, including a
  forced theme that contradicts the OS.
- Helpers: `.arail-figures` (tabular lining numerals) and `.arail-id` (mono
  identifier styling) — use them everywhere a figure or identifier appears.

## 11. Versioning

Brand assets are versioned with the repo. Changes to the mark geometry, seam
proportions, palette hexes, or letterforms require a design review and a
version bump in this document's header. The mark's seam path and the palette
names (Harbour, Verdigris, Slate) are considered stable identity — treat them
like an API contract.
