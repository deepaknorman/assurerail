# AssureRail — Typography

Three Google Fonts, all open (OFL), all self-hostable. Nothing else is permitted
in product or marketing surfaces.

| Role | Family | Weights | Used for |
|---|---|---|---|
| Display / headings | **Archivo** | 500, 600, 700 | Page titles, section heads, stat callouts, decks |
| Body / UI | **Inter** | 400, 500, 600 | Everything else: body copy, controls, tables, labels |
| Data / figures | **IBM Plex Mono** | 400, 500, 600 | Token IDs, ISINs, hashes, serials, amounts in ledgers, timestamps, code |

## Why this pairing

- **Archivo** — a grotesque rooted in the archive/print tradition (the name is
  literal: it was designed for archival headlines). Tall x-height, firm squared
  terminals, no fashion gestures. It carries the same engineered restraint as
  the Interlock mark, and it holds authority at deck-title sizes without
  shouting. We use 500–700 only; Archivo at 400 is too close to Inter to earn
  its place.
- **Inter** — the most proven screen-UI face available under an open licence.
  Neutral, dense-table-tested, excellent hinting at 12–14 px, and it has real
  **tabular figures** (`font-variant-numeric: tabular-nums`), which is
  non-negotiable in a venue UI where columns of amounts must align.
- **IBM Plex Mono** — institutional heritage rather than "hacker terminal".
  Unambiguous `0/O`, `1/l/I`, clear at 11–13 px, and its slightly humanist
  rhythm sits comfortably next to Inter. Every value an operator might read
  aloud to a counterparty — pool serials, VC hashes, settlement references —
  is set in Plex Mono.

## Loading

### Preferred: `next/font` (self-hosted automatically, zero runtime Google requests)

Bank and regulator CSPs should never see a `fonts.googleapis.com` request.
`next/font` downloads at build time and serves from our origin:

```tsx
// app/layout.tsx
import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-archivo",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="arail">{children}</body>
    </html>
  );
}
```

`tokens.css` already references `--font-archivo`, `--font-inter`, and
`--font-plex-mono` with literal-family fallbacks, so this wires up with no
further changes.

### Alternative: `<link>` (prototypes, static pages)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

### Alternative: CSS `@import`

```css
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap");
```

For fully offline deployments, `@fontsource/archivo`, `@fontsource/inter`, and
`@fontsource/ibm-plex-mono` provide the same files as npm packages.

## Usage rules

- Headings: Archivo 600 (700 for hero/display only). Letter-spacing
  `--arail-tracking-display` at ≥30 px, `--arail-tracking-heading` at 20–30 px.
- Body and all controls: Inter 400/500; 600 for emphasis. Never bold Inter to 700.
- Uppercase eyebrow labels: Inter 600, `--arail-tracking-label`, 11–12 px.
- Any value with legal or settlement meaning (IDs, hashes, ISINs, amounts in a
  register, timestamps) is Plex Mono — apply the `.arail-id` helper. Amounts in
  tables additionally get `.arail-figures` (tabular lining figures).
- Minimum sizes: Inter 12 px (11 px only in dense read-only tables), Plex Mono 11 px.
- Do not introduce additional families, italic display styles, or variable-width
  stunts. The identity's voice is set by restraint.
