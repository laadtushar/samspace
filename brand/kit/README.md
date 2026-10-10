# Samvriti.Space brand kit

The final identity, chosen 10 Oct 2026: **Kit A (two halves)** as the main logo, and **Kit C (the badge)** wherever the logo sits on a background the practice doesn't control.

- **The mark** is a brain whose back half is a tangle and whose front half is three calm lines. Read left to right, it's what a session is for.
- **The wordmark** is the tracked serif *samvriti.space* (round 2, direction E). It makes the same move as the mark: *samvriti* in forest, *space* in sage, with three clay dots (the two i tittles and the period).
- **The badge** is the same brain held in a forest circle. It's for browser tabs, phone home screens and Instagram and WhatsApp avatars, where a circle is the safest shape and the background is unknown.

Sources: wordmark `brand/E-wordmark.svg`; mark drawn from round 10's t3 sketch. Both are in the logo archive.

## Which file to use

| Where | Use | File |
|---|---|---|
| Website header, documents, slides | Horizontal lockup | `logo/svg/lockup-horizontal-color.svg` |
| Narrow or centred layouts, the business card front | Stacked lockup | `logo/svg/lockup-stacked-color.svg` |
| Dark pages and dark slides | Reversed lockup | `logo/svg/lockup-horizontal-reversed.svg` |
| Instagram, WhatsApp, Google profile photo | Badge on night | `social/instagram-avatar.png` |
| Browser tab | Badge, small cut | `favicon/favicon.svg`, `favicon/favicon.ico` |
| iPhone home screen | Badge on night, full bleed | `favicon/apple-touch-icon.png` (180px) |
| Android / web app manifest | Badge | `favicon/icon-192.png`, `favicon/icon-512.png`, `favicon/icon-maskable-512.png` |
| Link previews (WhatsApp, LinkedIn, X) | Open Graph image | `social/og-light.png` or `social/og-dark.png` (1200×630) |
| One-colour printing, stamps, embroidery | One-colour versions | `*-forest.svg`, `*-black.svg`, `*-white.svg` |
| Email signature | Horizontal lockup, transparent | `social/email-signature.png` (show at 600px wide) |

Every SVG is the master; PNGs are exported from them with transparent backgrounds at two sizes (marks 512 and 1024px; lockups and wordmarks 1200 and 2400px wide).

## Logo variants (`logo/svg/`, 41 files)

- **Mark:** `mark-color`, `mark-reversed`, and one colour in `mark-forest`, `mark-black`, `mark-white`.
- **Icon cut** (fewer, heavier loops, for 64px and below): `icon-color`, `icon-reversed`, `icon-forest`, `icon-black`, `icon-white`.
- **Badge:** `badge`, `badge-icon` (small-size cut), and one-colour knockouts `badge-forest`, `badge-black`, `badge-white`, `badge-icon-forest`, `badge-icon-black`, `badge-icon-white`. The knockouts are a solid disc with the drawing cut out, so they print in a single ink.
- **Wordmark:** `wordmark-color`, `wordmark-reversed`, `wordmark-forest`, `wordmark-black`, `wordmark-white`.
- **Lockups:** `lockup-horizontal-*` and `lockup-stacked-*` in `color`, `reversed`, `forest`, `black`, `white`.
- **Badge lockups:** `lockup-badge-horizontal-*` and `lockup-badge-stacked-*` in `light`, `dark`, `black`, `white`.

## Colour

Five colours, plus three tints of the same hues that exist only to pass contrast.

| Name | Hex | Role | Job |
|---|---|---|---|
| forest | `#2c3a2e` | Primary | Text, the tangle, outlines, buttons |
| sage | `#8a9e8c` | Secondary | The calm half and “space” on light grounds; graphics only, never text |
| clay | `#c17f5e` | Accent | Dots only: the stem's end, the i tittles, the period |
| cream | `#f7f3ed` | Light neutral | Page ground; the badge's lines |
| night | `#16201a` | Dark neutral | Dark ground for posts, app icons and dark pages |
| clay-ink | `#915f47` | Tint for text | Clay-coloured labels and links on cream |
| sage-light | `#a9bba9` | Tint for dark | The calm half and “space” on dark grounds |
| clay-light | `#d4956f` | Tint for dark | Dots, links and buttons on dark grounds |

Contrast, calculated with the WCAG 2 formula:

| Use | Pair | Ratio | Verdict |
|---|---|---|---|
| Body text on cream | `#2c3a2e` on `#f7f3ed` | 10.85 | Pass (4.5:1) |
| Muted text on cream | `#4f5d51` on `#f7f3ed` | 6.30 | Pass (4.5:1) |
| Clay ink labels on cream | `#915f47` on `#f7f3ed` | 4.83 | Pass (4.5:1) |
| Body text on night | `#f7f3ed` on `#16201a` | 15.13 | Pass (4.5:1) |
| Sage light text on night | `#a9bba9` on `#16201a` | 8.26 | Pass (4.5:1) |
| Clay light links on night | `#d4956f` on `#16201a` | 6.63 | Pass (4.5:1) |
| Night text on a clay-light button | `#16201a` on `#d4956f` | 6.63 | Pass (4.5:1) |
| Cream text on forest | `#f7f3ed` on `#2c3a2e` | 10.85 | Pass (4.5:1) |
| Sage on cream (graphics only) | `#8a9e8c` on `#f7f3ed` | 2.58 | Graphics only |
| Clay on cream (dots only) | `#c17f5e` on `#f7f3ed` | 2.94 | Graphics only |

`tokens.css` and `tokens.json` carry the same values. For Tailwind:

```js
colors: {
  forest: "#2c3a2e", sage: "#8a9e8c", clay: "#c17f5e", cream: "#f7f3ed", night: "#16201a",
  "clay-ink": "#915f47", "sage-light": "#a9bba9", "clay-light": "#d4956f",
}
```

The site's existing `forest-deep` (`#1e2a20`) is close to night and can stay for UI surfaces; use night for brand grounds (posts, app icons, dark pages).

## Type

- **Headlines:** Cormorant Garamond 500/600. Fallback: Georgia, "Times New Roman", serif.
- **Text:** DM Sans 400/500. Fallback: system-ui, -apple-system, "Segoe UI", sans-serif.
- **Licence:** both are on Google Fonts under the SIL Open Font License 1.1, and both are already loaded by the site.
- **Scale:** factor 1.25 from 16px (16 · 20 · 25 · 31 · 39 · 49 · 61).
- **The wordmark is artwork.** Never retype it in a font.

## Clear space and minimum size

- **Clear space:** keep the wordmark's x-height clear on every side of any lockup.
- **Horizontal lockup minimum:** 120px wide on screen, 30mm in print.
- **Below 64px, use a small cut, never the detailed mark:** use `icon-*` on grounds you control and `badge-icon` everywhere else.
- **Favicon:** the badge, because it reads on both light and dark browser tabs.

## Don'ts

1. Don't set sage or clay as text on cream (2.58:1 and 2.94:1). Use clay ink for clay-coloured text, and keep sage for the mark and *space*.
2. Don't swap the halves. The tangle stays at the back of the head and the calm lines face forward, in reading direction.
3. Don't use the detailed mark below 64px. Use the icon cut or the badge cut.
4. Don't put the badge on forest: it disappears. On dark grounds use night.
5. Don't retype, recolour, stretch or outline the wordmark. Use the supplied files.

## Applications

- **Favicons and app icons:** in `favicon/`.
- **Social images:** in `social/`: Open Graph light and dark (1200×630), Instagram avatar (1080), post template (1080) and story template (1080×1920), LinkedIn banner (1584×396), X header (1500×500), email signature.
- **Business card:** in `print/`. `business-card.pdf` is 85×55mm with two pages (front, back), and its text is embedded as outlines. It has no bleed, so ask the printer whether they need 3mm added.
