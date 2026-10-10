# BRAND.md — Sovereign OS design system

The single reference for the visual language actually shipped in
`src/app/globals.css` and `tailwind.config.ts`. Read this before touching
color, type, spacing, buttons, or surfaces. **Reuse these tokens and utility
classes — extend, don't reinvent, and never hand-write a value that a token
already owns.**

Copy and vocabulary rules live in `.cursorrules` §2 and `AGENTS.md` (banned
words, sentence case, honest claims). This file is about the *look*; those are
about the *voice*.

## Palette — dark-first, warm graphite

Dark-only. `color-scheme: dark` so native UI (date pickers, autofill,
`<select>`, scrollbars) renders dark. Hue sits in the low-30s with a hint of
warmth — a refined neutral cream scale, deliberately **no blue/indigo cast**.
Pure color is reserved for nothing but the user's own life data.

Values are HSL triplets consumed as `hsl(var(--token))` (Tailwind maps them to
`background`, `foreground`, `muted`, etc.).

| Token | HSL | Role |
|---|---|---|
| `--background` | `30 8% 4.5%` | Page — near-black warm graphite |
| `--foreground` | `38 18% 95%` | Primary text — warm cream |
| `--card` / `--card-foreground` | `30 7% 6%` / cream | Card surface |
| `--primary` / `--primary-foreground` | `38 18% 95%` / `30 9% 8%` | Cream fill, graphite label (user bubbles, send) |
| `--secondary` | `30 6% 12%` | Secondary surface |
| `--muted` / `--muted-foreground` | `30 6% 11%` / `32 8% 70%` | Muted body text (the default for supporting copy) |
| `--accent` | `30 8% 12.5%` | Subtle accent surface |
| `--destructive` | `6 58% 57%` | Errors / danger only |
| `--border` / `--input` | `30 7% 14%` / `30 7% 16%` | Hairlines, field borders |
| `--ring` | `38 26% 86%` | Warm keyboard focus ring |

### Surfaces — one layering model

Every panel steps through exactly three elevation tiers (replaces the old
ad-hoc `bg-card/xx` / `bg-muted/xx` fills):

| Token | HSL | Use |
|---|---|---|
| `--surface-1` | `30 7% 6.5%` | Lowest plate |
| `--surface-2` | `30 7% 8.5%` | Raised card / skeleton fill |
| `--surface-3` | `30 6% 11%` | Highest plate, gradient tops |

### The single gold accent

`--crown-gold` (a short lit hairline, `hsla(38, 74%, 72%, …)`) appears **only**
above a section crown, paired with a gold-tinted `<Eyebrow>`. It is the one
saturated mark on the page — a deliberate signature, not decoration. Do not
spread gold elsewhere.

## Radius — 6 / 8 / 12

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--radius-sm` | `6px` | `rounded-chip` | Chips, tags |
| `--radius-md` | `8px` | `rounded-control` | Buttons, inputs (matches `--radius: 0.5rem`) |
| `--radius-lg` | `12px` | `rounded-panel` | Cards, panels, sheets |

Fully-round (`rounded-full`) is reserved for genuinely circular elements
(avatars, icon buttons, the dot separators).

## Typography

Loaded via `next/font/google` in `src/app/layout.tsx`; exposed as CSS variables
consumed by `tailwind.config.ts`.

| Stack | Font | Tailwind | Role |
|---|---|---|---|
| `--font-sans` | **Manrope** | `font-sans` | Body, UI, everything default (set on `<body>`) |
| `--font-display` | **Instrument Serif** | `font-display` | Headings, editorial emphasis, assistant answers (serif = the "human" voice) |
| `--font-mono` | **JetBrains Mono** | `font-mono` | Eyebrows, labels, uppercase tracked micro-copy |

Sentence case for all headings, buttons, nav, CTAs. Proper nouns keep capitals
(Baseline, Sovereign, Sovereign+, NASA, JPL, Stripe).

## Buttons — three tiers, one scale

All inside the cream/graphite scale; all honor `prefers-reduced-motion`.

| Class | Look | Use |
|---|---|---|
| `.btn-focal` | Opaque dark-glass plate with one slow warm comet orbiting its edge — a cream→amber→terracotta ember, warm-only (7s `@property --edge` animation) | **The single focal conversion signal** — nav CTA, hero CTA. One per screen. |
| `.btn-aurora` | Solid cream (`#fbf7ef → #ece2cf`), deep soft shadow | In-app primary actions (forms, chat send) |
| `.btn-glass` | Translucent glass, hairline border, no orbit | Secondary actions |

All three carry `:focus-visible { outline: 2px solid hsl(38 30% 88%) }`. Never
swap `btn-focal` for `btn-aurora` to "make it pop" — the focal button's job is
to be the one distinctive thing, not the brightest.

## Utility classes (reuse these)

- `.glass-panel` — the standard translucent panel surface.
- `.card-lift` — hover lift on cards (motion-guarded).
- `.card-backlight` / `.demo-backlight` — soft warm glow behind a plate. The
  hero demo backlight keeps a tighter horizontal than vertical inset so the
  glow fades inside the viewport rather than clipping at the section edge.
- `.section-rule` — a hairline that fades at both ends (section divider).
- `.crown-gold` — the gold signature hairline above a section crown.
- `.app-glow` / `.hero-light` / `.hero-grid` — static ambient light + grid
  texture for the hero (never animated; reads as lighting, not decoration).
- `.grain-overlay` — ~2.5% film grain to kill flat black.
- `.tap-line` / `.tap-line-center` — a standalone tappable line (footer link,
  "read more"); the hook opts a link into the 44px floor.
- `.nav-link` / `.nav-brand` — header forms, carry the touch floor.
- `.skip-link` — WCAG 2.4.1 skip-to-content.
- `.consent-checkbox` — legal affirmation checkbox (grows to the 44px floor).
- `.select-custom` — styled native `<select>` arrow.

## Mobile floors — raised from ONE place

Both floors live in the single `@media (pointer: coarse)` block in
`globals.css`. Put the hook class on the element; **never hand-write
`min-h-[44px]` or a font-size at the call site.**

- **44px tap target** (`min-height: 2.75rem`) on `.btn:not(.btn-link)`,
  `.btn-size-icon`, `.tap-line`, `.nav-link`, `.nav-brand`, the three button
  tiers, `details > summary`, `.consent-checkbox`. A target sitting inside
  running prose is left alone (WCAG 2.5.8 exempts it — the line-height owns its
  size). Gate 24 measures the boxes in a real browser; Gate 3b proves the hooks
  are applied.
- **16px input floor** — `input, textarea, select, [contenteditable]` get
  `font-size: max(16px, 1rem) !important` so iOS Safari never auto-zooms on tap.
  The `!important` is load-bearing (Tailwind utilities are unlayered and would
  otherwise outrank the element selector); Gate 30 measures the winner.

## Motion

Strict `240ms` `easeOut` for reveals (`cubic-bezier(0.25, 0.1, 0.25, 1)`) — no
spring physics mixed with a hard duration. All animation is guarded by
`@media (prefers-reduced-motion: reduce)`. Ambient light and the hero grid are
deliberately **static**.
