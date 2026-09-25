---
name: KruKhayan Physics
description: A midnight transit diagram for one physics teacher's classes; every graded piece is a station, the target grade is the terminus.
colors:
  enamel: "oklch(19.5% 0.06 268)"
  enamel-raised: "oklch(23.5% 0.064 268)"
  enamel-tint: "oklch(27% 0.064 268)"
  divider: "oklch(32.5% 0.064 268)"
  rule-strong: "oklch(41% 0.062 268)"
  ink-faint: "oklch(70% 0.045 268)"
  ink-muted: "oklch(75% 0.034 268)"
  ink-soft: "oklch(82% 0.028 268)"
  ink-body: "oklch(89.5% 0.018 268)"
  ink-primary: "oklch(95.5% 0.01 268)"
  ink-bright: "oklch(98% 0.005 268)"
  porcelain: "oklch(96% 0.01 268)"
  sign-ink: "oklch(18% 0.03 268)"
  line-scarlet: "oklch(64% 0.215 27)"
  line-cobalt: "oklch(63% 0.19 262)"
  line-amber: "oklch(83% 0.165 80)"
  line-green: "oklch(71% 0.175 150)"
  status-danger: "oklch(77% 0.14 25)"
  status-danger-rule: "oklch(71% 0.18 25)"
  status-ok: "oklch(81% 0.13 150)"
  status-ok-rule: "oklch(75% 0.16 150)"
  status-pending: "oklch(84% 0.13 72)"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
  figure-hero:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum' 1, 'lnum' 1"
  figure-board:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "'tnum' 1, 'lnum' 1"
  figure-station:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1, 'lnum' 1"
  title:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Anuphan, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label-code:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "0.025em"
  wordmark:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sign: "6px"
  panel: "12px"
  full: "9999px"
spacing:
  rail: "36px"
  track: "5px"
  row-y: "10px"
  inline: "12px"
  board-x: "16px"
  grid-gap: "32px"
  grid-gap-wide: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.enamel-raised}"
    rounded: "{rounded.sign}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sign}"
    height: "36px"
    padding: "0 12px"
  line-sign:
    backgroundColor: "{colors.line-scarlet}"
    textColor: "#ffffff"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sign}"
    padding: "4px 10px"
  line-sign-amber:
    backgroundColor: "{colors.line-amber}"
    textColor: "{colors.sign-ink}"
    rounded: "{rounded.sign}"
    padding: "4px 10px"
  course-sign:
    textColor: "{colors.ink-primary}"
    typography: "{typography.display}"
    rounded: "{rounded.sign}"
    padding: "2px 12px"
  departure-board:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.sign}"
    width: "22rem"
  terminus-chip:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.full}"
    size: "40px"
  terminus-chip-selected:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.full}"
    size: "40px"
  terminus-chip-unreachable:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.full}"
    size: "40px"
  tab:
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    padding: "10px 16px"
  tab-active:
    textColor: "{colors.ink-primary}"
    typography: "{typography.body-sm}"
    padding: "10px 16px"
---

# Design System: KruKhayan Physics

## Overview

**Creative North Star: "The Midnight Line Map"**

The term is a rail line the student rides. Every graded piece is a station, each unit is its own coloured line, the exams are interchanges, and the ride ends at the grade the student is aiming for. The site is a transit diagram printed on midnight enamel: porcelain ink for words and station rings, four line inks for the routes, and the stretch the student has already travelled lit a little brighter, with a soft neon bleed. It stands in for the usual summary cards, percentage rings and progress bars, which this system does not use.

Density is operational. Most students read it on a phone in the evening or between classes, and the teacher enters scores for a 30 to 35 student room at a desk. So the map is calm and the figures do the talking. Scores sit in a condensed transit face with tabular numerals, right-aligned, and they never move. The one piece of motion is the line drawing itself in once when the page loads.

Dark is the default and a light theme sits one toggle away in the header. Light is the same map printed on paper: navy ink replaces porcelain, the glow is switched off, and the line inks deepen to hold contrast on white. No glass, no blur, no gradients, in either theme.

**Key Characteristics:**
- Midnight enamel ground (dark default), porcelain ink, and a light paper theme on the same tokens.
- Four line inks (scarlet, cobalt, amber, green) given to units in order. Exams ride porcelain.
- Filled disc = graded, hollow porcelain ring = not yet graded, and both always come with words.
- Barlow Semi Condensed for signage and every figure (tabular, lining); Anuphan for all Thai and UI text.
- Flat surfaces with 2px porcelain sign borders. The only light effect is a neon bleed on graded rails.
- Numbers stay still. The rail draws in once on load.

## Colors

A cold navy enamel family (hue 268) carries every surface and all ink. Four saturated transit inks carry meaning, and status hues are tuned for legibility on dark ground.

### Primary
- **Scarlet Line** (line-scarlet): the first unit's line, the "graded" glyph on the departure board, and the underline on the active tab. It is the one line ink that also works as UI chrome.
- **Cobalt Line** (line-cobalt): the second unit's line. Carries the text-selection wash (45% mix) and replaces amber as the focus ring in the light theme.
- **Amber Line** (line-amber): the third unit's line, the focus ring and text caret in the dark theme. Text on amber is always Sign Ink.
- **Signal Green Line** (line-green): the fourth unit's line. Units after the fourth start again at scarlet.

### Neutral
- **Midnight Enamel** (enamel): the page ground, the header, and the fill inside hollow stations and transfer rings.
- **Raised Enamel** (enamel-raised): the departure board, terminus chips, panels and inputs. Just one step lighter than the ground.
- **Enamel Tint** (enamel-tint): hover fill on chips and quiet row backgrounds.
- **Hairline** (divider): station-row separators, board row dividers, panel borders.
- **Strong Rule** (rule-strong): outline-button borders, the short rail behind the terminus chips, unreachable chip rings.
- **Porcelain** (porcelain): station rings, sign borders, the exam line, the terminus bar, the selected chip. On the light theme it becomes deep navy ink.
- **Porcelain Ink ramp** (ink-bright > ink-primary > ink-body > ink-soft > ink-muted > ink-faint): text from strongest to weakest. Use ink-primary for headings and earned figures, ink-soft for supporting sentences, ink-muted for the "/ max" denominator, and ink-faint for the dash that stands in for a missing score.
- **Sign Ink** (sign-ink): the dark text on amber signage. Stays dark in both themes.

### Status
- **Pending Amber** (status-pending): "ยังไม่มีคะแนน" (no score yet) and the missing-pieces count.
- **Reached Green** (status-ok, ring status-ok-rule): a target already secured.
- **Out-of-Reach Red** (status-danger, ring status-danger-rule): a target that can no longer be reached. Its terminus ring is also dashed, so the state does not depend on hue alone.

### Named Rules
**The Inherited Palette Rule.** Tailwind's slate, white, red, green, amber and blue-700 utilities are theme tokens. `globals.css` rebinds each of them (`--color-slate-800: var(--c-slate-800)` and so on) inside `@theme inline`, and defines the values twice: once on `:root` (dark) and once on `:root[data-theme="light"]`. In the dark theme slate is inverted, so slate-50 is the enamel ground, slate-800 is porcelain ink and `white` is raised enamel. Every existing page written with `bg-white`, `text-slate-800` or `border-slate-200` therefore changes theme without edits. Write new UI in those same utility names, or in `line-*` / `porcelain`, and never in raw colour values.

**The Line Ink Rule.** Line inks belong to units, cycling scarlet, cobalt, amber, green in unit order. Exams ride porcelain. A line ink can mark a rail, a line sign, a glyph or the active-tab underline. It never sets body text and never fills a large surface.

**The Amber Carries Dark Ink Rule.** Any text sitting on line-amber uses Sign Ink, in both themes.

## Typography

**Display / Signage Font:** Barlow Semi Condensed 500/600/700 (falls back to Anuphan, then system-ui), exposed as `font-sign`
**Body Font:** Anuphan (Thai + Latin; falls back to system-ui), exposed as `font-sans` and the document default

**Character:** A condensed station-signage sans for names and numbers next to a humanist Thai sans for everything people read in sentences. The pairing is roughly a rail operator's sign system next to a teacher's handwriting-level warmth.

### Hierarchy
- **Display** (600, 1.875rem, 1.25): the course name, set as a line sign inside a 2px porcelain frame.
- **Figure Hero** (600, 2.25rem, 1, tabular): the "ต้องได้อีก" (points still needed) readout. It is the largest number on the page.
- **Figure Board** (600, 1.875rem, 1, tabular): points earned on the departure board. Secondary board figures step down to 1.5rem.
- **Title** (600, 1.25rem): the departure-board heading.
- **Figure Station** (600, 1.25rem, tabular): each station's score, right-aligned, followed by a muted "/ max" in the same face.
- **Body** (400, 1rem, 1.5): station names, forecast headlines, terminus captions.
- **Body Small** (400, 0.875rem): tabs, hints, row labels, forecast detail.
- **Label Code** (600, tracking 0.025em): the K / P / A category code in front of the Thai category name.
- **Wordmark** (600, 15px, tracking 0.08em, uppercase): "KruKhayan Physics" in the header only.

### Named Rules
**The Transit Figure Rule.** Every score, maximum, count and grade uses `font-sign` plus `.tnum` (tabular and lining numerals), so digits line up in columns. Thai words always stay in Anuphan, even when they sit inside a figure line (for example "ชิ้น").

**The Readable Score Rule.** A score is never smaller than 1.25rem and never below ink-primary on its own row. Missing scores show an en dash in ink-faint next to the maximum. They never show a zero.

## Layout

Content sits in a 64rem (max-w-5xl) column, padded 16px on mobile and 24px from 640px up. The student route stacks on mobile with the departure board first and the strip map beneath it. From 1024px it becomes a two-column grid: the strip map on the left, and a 22rem departure board on the right that stays sticky 24px from the top. The column gap is 32px on mobile and 48px on wide screens.

The strip map is a list of rows. Each row has a fixed 36px rail column and the content beside it with a 12px inset. Stations use 10px vertical padding and hairline separators. Scores are right-aligned, and the name wraps before a score ever would. The rail column never shrinks.

## Elevation & Depth

The map is flat. Depth comes from two things: a ground and raised surface in the same enamel family, and 2px porcelain borders that frame signs the way a real station sign has a frame. There are no ambient or structural shadows.

### Shadow Vocabulary
- **Route glow** (`filter: drop-shadow(0 0 6px color-mix(in oklch, currentColor calc(var(--glow-strength) * 100%), transparent))`): applied only to graded rail segments and filled station discs, tinted by the line's own ink. `--glow-strength` is 0.55 in dark and 0 in light.

### Named Rules
**The Glow Belongs to the Route Rule.** Neon bleed marks where the student has been, and nowhere else. Cards, buttons, text and hover states do not glow. No glass, no blur, no gradients.

## Shapes

Transit geometry. Rails are straight 5px bars. Station glyphs are perfect circles: an 18px disc with a 3px porcelain ring for a piece, a 24px disc with a 4px ring for an exam, and a 14px ring on the enamel ground for a transfer between units. The end of the line is a 20px by 5px porcelain bar. Signs and buttons use a 6px corner, and legacy panels use 12px. In the header mark, lines bend only at 45 and 90 degrees.

## Components

### Buttons
Plain and fast. Built for the teacher's keyboard-driven work rather than for show.
- **Shape:** gently squared (6px).
- **Primary:** filled with porcelain ink, text on raised enamel, 8px 16px, 0.875rem. On the light theme it inverts to navy with white text, through the remap.
- **Outline (header):** 36px tall, 1px strong-rule border, ink-soft text. On hover the border steps up one tone and the text becomes ink-primary.
- **Focus:** a 2px amber outline, offset 2px, globally. It is cobalt in the light theme.
- **Disabled:** 50% opacity.

### Terminus Chips (target-grade selector)
- **Style:** 40px circles with a 3px porcelain ring, sitting on a short 5px strong-rule rail, with the grade in 600 tabular signage type.
- **Selected:** a solid porcelain fill with enamel text, exposed as `aria-pressed`.
- **Unreachable:** a strong-rule ring with ink-faint text. It can still be selected, and its label says "ไม่ทันแล้ว" (no longer reachable).

### Departure Board
- **Corner Style:** 6px.
- **Background:** raised enamel with a 2px porcelain border. A 2px porcelain rule separates the heading, the figures and the target block.
- **Rows:** a map glyph (filled scarlet disc, hollow ring, end bar), a Thai label in body-small ink-soft, and a right-aligned figure.
- **Forecast:** a terminus ring next to the "ต้องได้อีก N คะแนน" readout, announced through `aria-live="polite"`.

### Navigation
- **Header:** a 56px bar on the enamel ground with a hairline bottom rule. It holds the four-line interchange mark with the wordmark, the display name (hidden below 640px), the theme toggle (a 36px outlined square with an inline SVG sun or moon), and sign-out.
- **Tabs:** body-small ink-muted with a transparent 3px bottom border. The active tab turns ink-primary, medium weight, with a Scarlet Line underline. Tabs scroll horizontally on narrow screens.

### Line Sign
Each unit title sits in a 6px-cornered badge filled with its line ink, using white text (Sign Ink on amber). The exam sign is porcelain with enamel text. The course title uses the outline version: a 2px porcelain frame around display type.

### Strip Map (signature)
A vertical rail made of per-row track cells. Graded stations are filled discs in the line ink, with the glow. Ungraded stations are hollow enamel rings on a dimmed rail (30% opacity). When a target needs points from a station, its rail brightens in proportion to how many it needs (0.3 + 0.65 × share). Each hollow station says "ยังไม่มีคะแนน" (no score yet) and, when a target applies, "ควรได้ราว N" (should score about N). The rail draws in once: an enamel cover over the rail column scales from 1 to 0 over 1100ms with `cubic-bezier(0.16, 1, 0.3, 1)`. This is off under reduced motion, and without animation the cover's resting state leaves the rail fully visible.

## Do's and Don'ts

### Do:
- **Do** write colour through the remapped Tailwind names (`bg-white`, `bg-slate-50`, `text-slate-800`, `border-slate-200`, `text-amber-700`) or the `line-*` / `porcelain` utilities, so a surface follows the theme toggle with no extra work.
- **Do** add any new hue to both the `:root` and `:root[data-theme="light"]` blocks and bind it in `@theme inline`, in OKLCH.
- **Do** set every number in `font-sign` with `.tnum`, right-aligned, with the maximum in ink-muted after a slash.
- **Do** pair every station state with words. A hollow ring always comes with "ยังไม่มีคะแนน" (no score yet).
- **Do** assign line inks by unit order (scarlet, cobalt, amber, green, then repeat) and put exams on porcelain.
- **Do** keep the glow limited to graded rails and station discs, driven by `--glow-strength`.
- **Do** respect `prefers-reduced-motion`. The rail reveal is the only load animation.

### Don't:
- **Don't** use glass, blur or gradients.
- **Don't** animate, count up or re-flow score figures. Numbers never move.
- **Don't** fall back on summary cards, percentage rings or progress bars for student progress. The line map replaces them.
- **Don't** hard-code hex or oklch values, or Tailwind's stock palette, in components. They will not follow the theme.
- **Don't** put light text on amber. Use Sign Ink.
- **Don't** add steps, animation or layout weight to the teacher's score-entry flow. It must stay as fast as it is now.
- **Don't** show a grade before every piece is scored. Until then, the terminus is the student's chosen target, labelled as one.
