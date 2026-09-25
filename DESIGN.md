---
name: KruKhayan Physics
description: A neon circuit board for one physics teacher's classes; each unit is a glowing copper trace, every graded piece a solder pad, the target grade the terminal.
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
  trace-magenta: "oklch(66% 0.26 345)"
  trace-cyan: "oklch(83% 0.14 205)"
  trace-yellow: "oklch(90% 0.17 102)"
  trace-lime: "oklch(85% 0.2 138)"
  status-danger: "oklch(77% 0.14 25)"
  status-danger-rule: "oklch(71% 0.18 25)"
  status-ok: "oklch(81% 0.13 150)"
  status-ok-rule: "oklch(75% 0.16 150)"
  status-pending: "oklch(84% 0.13 72)"
typography:
  display-hero:
    fontFamily: "Chakra Petch, Anuphan, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
  display:
    fontFamily: "Chakra Petch, Anuphan, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Chakra Petch, Anuphan, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  chip-label:
    fontFamily: "Chakra Petch, Anuphan, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.375
  wordmark:
    fontFamily: "Chakra Petch, Anuphan, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.06em"
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
  figure-pad:
    fontFamily: "Barlow Semi Condensed, Anuphan, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1, 'lnum' 1"
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
rounded:
  ic: "3px"
  chip: "4px"
  control: "6px"
  full: "9999px"
spacing:
  rail: "36px"
  trace: "5px"
  row-y: "10px"
  inline: "12px"
  board-x: "16px"
  grid-gap: "32px"
  grid-gap-wide: "48px"
components:
  button-outline:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  button-chip:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.chip}"
    padding: "8px 16px"
  chip-panel:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.chip}"
  unit-chip-label:
    textColor: "{colors.ink-primary}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.chip}"
    padding: "4px 10px"
  course-chip:
    textColor: "{colors.ink-primary}"
    typography: "{typography.display}"
    rounded: "{rounded.chip}"
    padding: "2px 12px"
  port-link:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.chip}"
    padding: "14px 16px"
  readout-board:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.control}"
    width: "22rem"
  terminal-pad:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.full}"
    size: "40px"
  terminal-pad-selected:
    backgroundColor: "{colors.porcelain}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.full}"
    size: "40px"
  score-input:
    backgroundColor: "{colors.enamel-raised}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.chip}"
    width: "56px"
  tab-active:
    textColor: "{colors.ink-primary}"
    typography: "{typography.body-sm}"
    padding: "10px 16px"
---

# Design System: KruKhayan Physics

## Overview

**Creative North Star: "The Neon Circuit Board"**

The site is a printed circuit board at night. A navy solder-mask ground carries a faint copper-trace pattern everywhere. Each unit of the term is a neon trace in its own colour, each graded piece is a solder pad on that trace, the exams are IC chips, and the trace runs to a terminal that holds the grade the student is aiming for. Physics lives on top of the board as drawn apparatus: a bar magnet with its field lines, an electromagnetic wave, a resistor-and-capacitor circuit, and the equations that go with them, all in the four trace inks.

Intensity follows the page's job. First-view pages (login, dashboard home) run hot: a full neon physics hero, a signal pulse running along a trace, bold Chakra Petch headlines. Working pages (the student's score board, the teacher's score table) run cool: flat chips, thin coloured bands, and the figures doing the talking. Numbers are set in a condensed face with tabular digits and never move, and score entry is never slowed by decoration.

Dark is the default; the light theme is the same board printed on white. Navy ink replaces porcelain, trace inks deepen to hold contrast, and every glow switches off.

**Key Characteristics:**
- Navy solder-mask ground (dark default) with a faint copper-trace and pad pattern on the body; a light theme on the same tokens.
- Four neon trace inks (magenta, cyan, yellow, lime) given to units in order. Exams run on porcelain.
- Solder pad with a drill hole = scored, hollow porcelain ring = not yet scored, square IC = exam, and every state comes with words.
- Chakra Petch for headings, chips and labels (Thai and Latin); Anuphan for reading text; Barlow Semi Condensed for every figure.
- Intense on first-view pages, quiet on working pages.
- Numbers stay still. Motion is one rail reveal on the score board and one signal pulse in the login hero.

## Colors

A cold navy family (hue 268) carries every surface and all ink; four saturated neon trace inks carry unit identity; status hues are tuned for legibility on the dark ground.

### Primary
- **Neon Magenta Trace** (trace-magenta): the first unit's trace, the "scored" pad on the readout board, the active-tab underline, the accented word in the login headline, the Google sign-in button fill, and the magnet's north pole.
- **Neon Cyan Trace** (trace-cyan): the second unit's trace, the glowing hairline under the header, the text-selection wash (45% mix), the focus ring in the light theme, and course-list glyphs.
- **Neon Yellow Trace** (trace-yellow): the third unit's trace, the dark-theme focus ring and text caret, and the running signal pulse. Text on yellow is always Sign Ink.
- **Neon Lime Trace** (trace-lime): the fourth unit's trace. Units after the fourth start again at magenta.

### Neutral
- **Solder Mask** (enamel): page ground, header bar, and the fill inside hollow pads, vias and the chip logo core.
- **Raised Mask** (enamel-raised): readout board, panels, chips, inputs, terminal pads.
- **Mask Tint** (enamel-tint): hover fill on rows, links and pads.
- **Hairline** (divider): row separators, port-link borders at rest.
- **Strong Rule** (rule-strong): outline-button and input borders, the short rail behind the target pads, unreachable pad rings.
- **Porcelain** (porcelain): pad rings, chip borders around panels and the course name, the exam trace, IC chips, the end-of-line bar. In light theme it becomes deep navy ink.
- **Porcelain Ink ramp** (ink-bright > ink-primary > ink-body > ink-soft > ink-muted > ink-faint): text from strongest to weakest. ink-primary for headings and earned figures, ink-soft for supporting sentences, ink-muted for the "/ max" denominator, ink-faint for the dash that stands in for a missing score.
- **Sign Ink** (sign-ink): dark text on yellow, lime and cyan fills, and the magnet's south pole label. Dark in both themes.

### Status
- **Pending Amber** (status-pending): "ยังไม่มีคะแนน" (no score yet) and the missing-pieces count.
- **Reached Green** (status-ok, ring status-ok-rule): a target already secured; "all saved" in the score table.
- **Out-of-Reach Red** (status-danger, ring status-danger-rule): a target that can no longer be reached, with a dashed ring so the state never depends on hue alone.

### Named Rules
**The Inherited Palette Rule.** Tailwind's slate, white, red, green, amber and blue-700 utilities are theme tokens: `globals.css` rebinds each inside `@theme inline` to a `--c-*` variable defined once on `:root` (dark) and once on `:root[data-theme="light"]`. In dark, slate is inverted (slate-50 is the ground, slate-800 is porcelain ink, `white` is raised mask). Write UI in those utility names or in `trace-*` / `porcelain`, never in raw colour values.

**The One Unit, One Trace Rule.** Trace inks belong to units, cycling magenta, cyan, yellow, lime in unit order through `unitTrace()` in `src/lib/traces.ts`, the same on the student board and the teacher table. Exams run on porcelain. Outside unit identity, a trace ink may mark an accent (active tab, focus, header hairline, first-view art, dashboard port dots) but never sets body text or fills a large working surface.

**The Dark Ink on Bright Traces Rule.** Text sitting on a yellow, lime or cyan fill uses Sign Ink, in both themes.

## Typography

**Display Font:** Chakra Petch 500/600/700 (falls back to Anuphan, then system-ui), exposed as `font-display`
**Body Font:** Anuphan (Thai and Latin, falls back to system-ui), exposed as `font-sans` and the document default
**Figure Font:** Barlow Semi Condensed 500/600/700 (falls back to Anuphan), exposed as `font-num`

**Character:** A squared, chip-silkscreen display face with real Thai glyphs for headings and labels, a warm humanist Thai sans for reading, and a condensed numeral face that keeps columns of scores tight and aligned.

### Hierarchy
- **Display Hero** (700, 2.25rem to 3rem at 640px+, 1.05): the login headline only, with one word in magenta.
- **Display** (700, 1.875rem, 1.25): page headings (greeting, "รายวิชาของฉัน") and the course name in its porcelain chip frame (600 there).
- **Title** (600, 1.25rem): readout-board and login-form headings; course names in lists at 1.125rem.
- **Chip Label** (600, 15px, 1.375): unit chip labels on the board and unit group headers in the teacher table; K / P / A codes in 600.
- **Wordmark** (600, 15px, tracking 0.06em, uppercase): "KruKhayan Physics" beside the chip logo.
- **Figure Hero** (600, 2.25rem, 1, tabular): the "ต้องได้อีก" (points still needed) readout, the largest number on the page.
- **Figure Board** (600, 1.875rem, 1, tabular): points earned; secondary board figures at 1.5rem.
- **Figure Pad** (600, 1.25rem, tabular): each pad's score, right-aligned, with a muted "/ max" in the same face.
- **Body** (400, 1rem, 1.5): pad names, forecast headlines, terminal captions.
- **Body Small** (400, 0.875rem): tabs, hints, row labels, forecast detail, score-table cells.

### Named Rules
**The Figure Rule.** Every score, maximum, count and grade uses `font-num` with `.tnum` (tabular, lining), so digits line up. Thai words stay in Anuphan even inside a figure line (for example "ชิ้น").

**The Readable Score Rule.** A student-facing score is never smaller than 1.25rem and never dimmer than ink-primary on its own row. A missing score shows an en dash in ink-faint next to the maximum, never a zero.

## Layout

Working pages sit in a 64rem (max-w-5xl) column; the dashboard home uses 56rem and the course list 48rem. Padding is 16px on mobile and 24px from 640px up. The student score view stacks on mobile with the readout board first; from 1024px it becomes a two-column grid with the trace map left and a 22rem readout board right, sticky 24px from the top, with a 32px gap (48px wide).

The trace map is a list of rows: a fixed 36px rail column and content beside it with a 12px inset, 10px vertical padding and hairline separators. Scores are right-aligned and names wrap before a score does.

The login page is a two-column split from 1024px (art column 1.15fr, form column 1fr, the form side on a 60% ground wash with a hairline left rule); on mobile the headline and a shortened hero (176px tall) sit above the form. The dashboard home is a porcelain-framed banner followed by a two-column grid of port links from 640px.

## Elevation & Depth

Flat. Depth comes from the ground and raised surfaces of the same navy family, 2px porcelain frames around chips and panels, and the faint copper-trace pattern on the body (2px strokes at 7% and 4px pads at 10% of cyan in dark; navy at 5% and 7% in light). There are no box shadows. Light is the only lift, and it is neon.

### Shadow Vocabulary
- **Trace glow** (`filter: drop-shadow(0 0 6px color-mix(in oklch, currentColor calc(var(--glow-strength) * 100%), transparent))`): scored trace segments and pads, and the cyan hairline under the header. `--glow-strength` is 0.55 in dark, 0 in light.
- **Neon art filter** (SVG `feGaussianBlur` stdDeviation 3.2 merged over the source, class `.neon-soft`): field lines, waves and the signal pulse in the physics art. Removed in light theme.

### Named Rules
**The Glow Marks Current Rule.** Neon glow sits only where signal flows: scored traces and pads, the header hairline, and the first-view physics art. Cards, buttons, text, table cells and hover states do not glow. Light theme has no glow at all.

## Shapes

Circuit geometry. Traces are straight 5px bars; decorative traces bend only at 45 and 90 degrees with square caps. Pads are circles: an 18px disc with a 3px porcelain ring and a 4px drill hole when scored, a hollow ring on the mask when not. Exams are 24px squares with a 3px corner (IC chips), filled porcelain when scored. A 14px porcelain ring on the mask marks a via where one unit's trace hands over to the next. The end of the line is a 20px by 5px porcelain bar. Chips, panels and chip-style buttons use a sharp 4px corner; header buttons and inputs keep 6px; terminal and target pads are full circles.

## Components

### Buttons
Squared and plain on working pages; one neon fill allowed on the login page.
- **Shape:** chip corner (4px) for form buttons, control corner (6px) for header utilities.
- **Chip button (form submit):** transparent, 2px porcelain frame, ink-primary 600 text, 8px vertical padding, mask-tint on hover.
- **Magenta action (login Google sign-in):** magenta fill, white 600 text, the Google mark on a white disc, brightness 110% on hover. It is the only filled accent button in the build.
- **Outline (header, table utilities):** 36px tall, 1px strong-rule border, ink-soft text; on hover the border steps up one tone and text becomes ink-primary.
- **Focus:** a global 2px yellow outline, offset 2px; cyan in light theme.
- **Disabled:** 50% opacity.

### Chips / Unit Labels
- **Unit chip label:** 4px corner, 2px border in the unit's trace, a 14% trace-tint fill, ink-primary Chakra Petch text, and the unit's physics glyph (20px) in the trace ink. The exam chip has no glyph and runs on porcelain.
- **Course chip:** the course name in display type inside a 2px porcelain frame, 4px corner.

### Cards / Containers
- **Corner Style:** 4px (chip).
- **Background:** raised mask.
- **Shadow Strategy:** none; see Elevation.
- **Border:** 2px porcelain for primary panels (login form, course list, dashboard banner, readout board at 6px); 2px hairline for port links, stepping to rule-strong on hover.
- **Internal Padding:** 16px for lists and boards, 28px for the login form.

### Inputs / Fields
- **Style:** raised mask, 1px strong-rule border, 6px corner, 12px by 8px padding, body-small; the caret is yellow (cyan-focus in light).
- **Score cell:** 56px wide, 4px corner, centred, body-small. Its colour states are unchanged from the incumbent entry flow, and nothing is added to it.

### Navigation
- **Header:** a 56px bar on the mask with a hairline bottom rule and a glowing 1px cyan trace at 60% beneath it. It holds the chip logo (a porcelain IC with four trace-coloured legs) and the wordmark, the display name (hidden below 640px), the theme toggle and sign-out.
- **Tabs:** body-small ink-muted with a transparent 3px bottom border; active is ink-primary, medium weight, with a magenta underline. Tabs scroll horizontally on narrow screens.
- **Port links (dashboard home):** each destination is a connector on the board: a 12px pad in its own trace ink with a porcelain ring, a Chakra Petch label over a muted note, and an arrow that brightens on hover.

### Trace Map (signature)
The student's term as a vertical circuit. Scored pads are filled in the unit trace with a mask-coloured drill hole and the trace glow. Unscored pads are hollow porcelain rings on a dimmed trace (30% opacity) that brightens with how much of the chosen target depends on them (0.3 + 0.65 × share). Every hollow pad says "ยังไม่มีคะแนน" (no score yet) and, when a target applies, "ควรได้ราว N" (should score about N). A via marks each unit transfer; a chip label heads each unit. The rail reveals once: a mask-coloured cover over the rail column scales from 1 to 0 over 1100ms with `cubic-bezier(0.16, 1, 0.3, 1)`, disabled under reduced motion, and the resting state shows the full rail.

### Readout Board and Terminal Pads
A 22rem raised panel with a 2px porcelain frame and 6px corner, porcelain rules between heading, figures and the target block. Rows pair a map glyph (magenta pad, hollow ring, end bar) with a Thai label and a right-aligned figure. Target grades are 40px circular pads with a 3px porcelain ring on a short 5px strong-rule rail; selected fills porcelain with mask text (`aria-pressed`), unreachable dims to a strong-rule ring with faint text. The forecast pairs a 48px terminal pad with the "ต้องได้อีก N คะแนน" readout, announced through `aria-live="polite"`.

### Teacher Score Table (unit-banded)
Each unit's column group carries its trace: the group header has a 4px top band in the full trace, a 16% trace tint and the unit glyph (16px) beside the Chakra Petch title; every cell below carries a 7% tint and the group opens with a 2px left separator at 70% of the trace. Exams band in porcelain. No glow, no motion, no extra controls.

### Physics Art (first-view only)
SVG, inline, `aria-hidden`, coloured only from `--trace-*` and `--porcelain`. **PhysicsHero** (login): magnet with field lines, EM wave, resistor/capacitor circuit, equations in Chakra Petch, and one yellow signal pulse (12-unit dash travelling along the circuit, 2.8s ease-in-out loop, off under reduced motion). **PhysicsBanner** (dashboard home): a medium-intensity strip behind the greeting, dropped to 40% opacity under 640px. **UnitGlyph**: 24px line icons at 1.8 stroke chosen from the unit title (magnet, thermometer, droplet on crystal, wave, atom fallback).

## Do's and Don'ts

### Do:
- **Do** write colour through the remapped Tailwind names (`bg-white`, `bg-slate-50`, `text-slate-800`, `border-slate-200`) or the `trace-*` / `porcelain` utilities, so a surface follows the theme toggle.
- **Do** add any new hue to both the `:root` and `:root[data-theme="light"]` blocks and bind it in `@theme inline`, in OKLCH.
- **Do** assign unit colour only through `unitTrace()` and exams through `EXAM_TRACE`, so the student board and teacher table always agree.
- **Do** set every number in `font-num` with `.tnum`, right-aligned, with the maximum in ink-muted after a slash.
- **Do** set headings, chip labels and the wordmark in `font-display`, and reading text in Anuphan.
- **Do** pair every pad state with words; a hollow ring always comes with "ยังไม่มีคะแนน".
- **Do** keep the heavy physics art and signal pulse on first-view pages, and keep working pages to chips, bands and tints.
- **Do** mark decorative SVG `aria-hidden` and respect `prefers-reduced-motion`.

### Don't:
- **Don't** put glow on cards, buttons, text, table cells or hover states, and never in light theme.
- **Don't** animate, count up or re-flow score figures. Numbers never move.
- **Don't** add steps, decoration, animation or layout weight to the teacher's score-entry flow.
- **Don't** fall back on summary cards, percentage rings or progress bars for student progress; the trace map replaces them.
- **Don't** hard-code hex or oklch values, or Tailwind's stock palette, in components.
- **Don't** put light text on yellow, lime or cyan; use Sign Ink.
- **Don't** show a grade before every piece is scored; until then the terminal is the student's chosen target, labelled as one.
- **Don't** use glass, blur panels or gradient fills on surfaces.
