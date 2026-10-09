---
name: jasonobawemimo.com
description: The After Hours Library. A flagship console's home screen after close, with Jason's career as the library on it.
colors:
  bone: "#ede7db"
  bone-2: "#d9d2c4"
  bottle: "#1c3229"
  bottle-2: "#24402f"
  bronze: "#9c6b43"
  silver: "#b9bcbe"
  gold: "#c9a96a"
  platinum: "#dcdde0"
  ink: "#0a0f0d"
  lacquer: "#111b17"
  lacquer-2: "#16221d"
  ash: "#9a9890"
  ash-2: "#7d7b74"
  hair: "rgba(237, 231, 219, 0.14)"
  hair-2: "rgba(237, 231, 219, 0.24)"
typography:
  display:
    fontFamily: "Cormorant Garamond, Cormorant, Garamond, serif"
    fontSize: "clamp(56px, 8.4vw, 132px)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "0.12em"
  logotype:
    fontFamily: "Cormorant Garamond, Cormorant, Garamond, serif"
    fontSize: "clamp(44px, 4.6vw, 76px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
  headline:
    fontFamily: "Cormorant Garamond, Cormorant, Garamond, serif"
    fontSize: "clamp(40px, 5vw, 76px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.1em"
  title:
    fontFamily: "Cormorant Garamond, Cormorant, Garamond, serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.12em"
  numeral:
    fontFamily: "Cormorant Garamond, Cormorant, Garamond, serif"
    fontSize: "clamp(40px, 3.6vw, 56px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.01em"
    fontFeature: "\"lnum\" 1, \"tnum\" 1"
  lead:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.01em"
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.14em"
  caption:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  plate: "3px"
  panel: "4px"
  frame: "6px"
  pill: "20px"
  round: "999px"
spacing:
  gutter: "clamp(16px, 4.7vw, 72px)"
  gutter-phone: "16px"
  bar: "76px"
  bar-phone: "60px"
  xs: "8px"
  sm: "14px"
  md: "26px"
  lg: "34px"
components:
  button-primary:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.plate}"
    padding: "0 22px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "#fff8ec"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.button}"
    rounded: "{rounded.plate}"
    padding: "0 22px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "rgba(237, 231, 219, 0.08)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.plate}"
    padding: "0 22px"
    height: "46px"
  button-large:
    rounded: "{rounded.plate}"
    padding: "0 30px"
    height: "54px"
  chip:
    backgroundColor: "rgba(17, 27, 23, 0.7)"
    textColor: "{colors.bone}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
  status-pill:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  menu-row:
    backgroundColor: "rgba(17, 27, 23, 0.74)"
    textColor: "{colors.bone}"
    rounded: "{rounded.panel}"
    padding: "16px 20px"
  menu-row-focus:
    backgroundColor: "{colors.bottle}"
  menu-row-picked:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
  equip-row:
    backgroundColor: "rgba(17, 27, 23, 0.6)"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.panel}"
    padding: "7px 14px 7px 8px"
    height: "56px"
  equip-row-on:
    backgroundColor: "{colors.bottle}"
    textColor: "{colors.bone}"
  shelf-tile:
    backgroundColor: "{colors.lacquer-2}"
    rounded: "{rounded.frame}"
    size: "136px"
  shelf-tile-focus:
    size: "162px"
  trophy-rack:
    backgroundColor: "rgba(17, 27, 23, 0.9)"
    textColor: "{colors.bone}"
    rounded: "{rounded.frame}"
    padding: "16px 18px"
    width: "250px"
  toast:
    backgroundColor: "{colors.lacquer}"
    textColor: "{colors.bone}"
    rounded: "{rounded.frame}"
    padding: "14px 18px"
    width: "380px"
  build-card:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bone}"
    rounded: "{rounded.frame}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "{rounded.plate}"
    padding: "10px 14px"
  tab-active:
    textColor: "{colors.bone}"
  field-underline:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    rounded: "0px"
    height: "50px"
  field-boxed:
    backgroundColor: "rgba(10, 15, 13, 0.7)"
    textColor: "{colors.bone}"
    rounded: "{rounded.panel}"
    padding: "12px 14px"
  system-bar:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    height: "{spacing.bar}"
  desk-phone:
    backgroundColor: "#1c1f1d"
    rounded: "50px"
    padding: "11px"
    width: "300px"
    height: "620px"
  desk-screen:
    backgroundColor: "#f2f2f7"
    textColor: "#111111"
    rounded: "40px"
---

# Design System: jasonobawemimo.com

## Overview

**Creative North Star: "The After Hours Library"**

The site is a flagship game console's home screen after close, and Jason's career is the library on it. Each title (Triple J Auto, Lead to Title, The Inbound, Prospector, Neuroscience, and Obavia as a small side quest) owns one piece of full-bleed cinematic key art, and the interface around it is the console's quiet chrome: a system bar, a shelf of square tiles, the focused title's logotype, role, summary and two stats, a trophy rack, a control legend. The room is dark, the art is lit, and the chrome stays out of the art's way.

The UI is achromatic on purpose. Grounds are green-black ink and lacquer, type and edges are bone, held states are bottle green from the suit in the headshot, and every hue a visitor sees comes from the key art (sodium amber, wet asphalt, a bottle-green night) or from a trophy's minted metal. Density is one title at a time: the home screen is a fixed composition, not a scroll, and an opened title or screen becomes its own page laid over the dimmed art in a single left-aligned column. Motion is slow and sure: one ease, nothing bounces or shakes, and the focus ring breathes. The world refuses the scrolling resume, the neon gamer HUD, and the effects-heavy dash that preceded it (retired; none of its needle red, leather or gauges survive).

This file governs the library world: the home page (index.html, generated from tools/site/home.body.html, styled by game.css, build.css and desk.css) and /obavia.html (game.css, desk.css, obavia.css). Two other worlds ship on the same domain and are not governed here. The proof pages (credentials, answers, profile, knowledge card, mentions, honor, search) use tokens.css and proof.css: an older world with its own lacquer, a gold chromatic accent, ivory type, pill buttons and overshooting springs. The resume pages (resume-pdf.html and resume/*.html) use resume.css: a print-first US Letter sheet, near-black on white, title case with no tracking, static fonts. Neither should borrow from this file, and this file should not borrow from them.

**Key Characteristics:**
- Full-bleed graded key art behind everything; its dark left side is where the type lives.
- Achromatic chrome: ink grounds, bone actions and focus, bottle green for what is held.
- Metal only on trophies: bronze, silver, gold, platinum medals and the build card's frame.
- Tracked Cormorant Garamond capitals name things; Hanken Grotesk does all the reading.
- Matte, near-opaque lacquer panels lit by one bone hairline on the top edge. No glass.
- Square tiles with a breathing bone focus ring and two corner ticks.
- One ease, cubic-bezier(0.2, 0.7, 0.1, 1); motion that settles, never overshoots.

## Colors

An after-hours room: green-black grounds, bone type and edges, and colour only where the key art or a trophy's metal puts it.

### Primary
- **Bone** (#ede7db): the action and focus colour. The primary button's fill, the 2px focus outline, the focused tile's ring and corner ticks, a selected chip, a picked menu row, the active tab's underline, and body text. It is warm white, not a hue: the world has no chromatic UI accent.
- **Bone Low** (#d9d2c4): second-tier text that still has to read over art: role lines, summaries inside panels, menu sublines, the build card's line.

### Secondary
- **Bottle Green** (#1c3229): the held state. The focused menu row on the title screen, an equipped proof row, the chosen lesson on Obavia, a filled Player 2 ring, a completed desk step, the matched-term plates. It marks what is chosen or under the cursor; it is never the fill of a call to action.
- **Bottle Deep** (#24402f): scrollbar thumb, text selection, the edge of a completed step.

### Tertiary
- **Bronze** (#9c6b43), **Silver** (#b9bcbe), **Gold** (#c9a96a), **Platinum** (#dcdde0): the trophy tiers. They appear on the minted medal rasters (assets/game/medals), the build card's double frame (which takes the chosen finish), the finish swatches on the build screen, the Player 2 ring's edge, and the trophy glyph beside the count in the system bar. Nowhere else.

### Neutral
- **Ink** (#0a0f0d): the ground of every page, the stage behind the art, the sticky tabs, the build card. Scrims over art are ink at rising alpha.
- **Lacquer** (#111b17): the opaque panel surface. Toasts, the level clear card, drawers, the phone action bar, Obavia's get bar, the calendar well. Over art it is laid at 0.6 to 0.9 alpha (rows, chips, the trophy rack) and never blurred.
- **Lacquer Raised** (#16221d): image wells behind tiles and app icons before the art arrives.
- **Ash** (#9a9890): tertiary text. Labels, tier suffixes, stat keys, captions, inactive tabs, Skip. About 6.7:1 on ink and 6:1 on lacquer.
- **Ash Low** (#7d7b74): placeholders and the empty Player 2 ring. About 4.5:1 on ink; nothing goes dimmer.
- **Hairline** (rgba 237, 231, 219 at 0.14) and **Hairline Strong** (the same bone at 0.24): every divider, the top edge of a raised panel, the outline of chips, status pills and the Player 2 slot.

### Named Rules
**The Key Art Carries the Colour Rule.** The chrome has no chromatic accent. Hue comes from the graded key art behind it; when a control needs emphasis it gets bone, not a colour.

**The Metal Means a Trophy Rule.** Bronze, silver, gold and platinum appear only where a trophy or the build card's finish is being shown. A metal on a button, a link or a heading is a bug.

**The Bottle Holds, Bone Acts Rule.** Bottle green marks what is held or chosen; bone marks what you can act on and where focus is. A row can be bottle with a bone edge; a button is never bottle.

## Typography

**Display Font:** Cormorant Garamond (with Cormorant, Garamond, serif), weights 500 and 600
**Body Font:** Hanken Grotesk (with system-ui, sans-serif), weights 400, 500 and 600

**Character:** Engraved, widely tracked serif capitals give every title the weight of a game logotype; a clean grotesk carries every sentence and every control, so the serif never has to explain anything.

### Hierarchy
- **Display** (Cormorant 600, clamp(56px, 8.4vw, 132px), 0.92, tracked 0.12em, uppercase): the name on the title screen, set as two stacked lines.
- **Logotype** (Cormorant 600, clamp(44px, 4.6vw, 76px), 1, tracked 0.12em, uppercase, balanced): the focused title's name, screen names (Trophies, a player's build, the profile name). Obavia's mark runs larger and wider (clamp(64px, 8vw, 128px), 0.16em).
- **Headline** (Cormorant 500, clamp(40px, 5vw, 76px), 1, tracked 0.1em, uppercase): the title screen's questions and the build step's heading, the level clear's trophy name (54px, 0.14em), deck slides.
- **Title** (Cormorant 500, 22px, 1, tracked 0.12em, uppercase): trophy group heads over a hairline, drawer heads (38px).
- **Numeral** (Cormorant 500, clamp(40px, 3.6vw, 56px), 1, lining tabular figures): the two stats under a title and the profile's level. The system bar's level figure is Cormorant 600 at 17px.
- **Lead** (Hanken 400, 18px, 1.5, up to 62ch): the focused title's summary and the profile bio. Bullet points run 17px at 1.6 to 66ch.
- **Body** (Hanken 400, 16px, 1.55): the default.
- **Button** (Hanken 500, 16px, 1, 0.01em): buttons, the system bar name (18px), menu row titles (19px), tile names (16px, 19px when focused).
- **Label** (Hanken 500, 12 to 13px, tracked 0.14 to 0.16em, uppercase, ash): section heads inside an open title (Overview, Loadout), control-group heads on the build screen, data keys (Level, the Player 2 slot's line), tier suffixes after a trophy name.
- **Caption** (Hanken 400, 13 to 14px, 1.35, ash): stat keys, fine print, figure captions, the control legend (bone-2).

### Named Rules
**The Logotype Rule.** The name of a thing (a title, a screen, the person) is Cormorant capitals at 600 tracked 0.12em; secondary heads in the same voice drop to 500. On phones tracking tightens to 0.06 to 0.08em so a long name holds one or two lines.

**The Grotesk Does the Talking Rule.** Every sentence, every control and every figure that is chrome (the clock, the trophy count, step and menu numbers) is Hanken Grotesk. The serif only names things and sets the figures that are the point.

**The Label Is a Key Rule.** Small tracked capitals label a section, a control group or a value. They never sit above a headline to introduce it.

The direction contract asked for thin Hanken Grotesk numerals; the build sets its headline figures in Cormorant 500, and that is what this file records.

## Layout

The home screen is a fixed composition over full-bleed art, not a scrolling page. The system bar runs across the top (76px tall; 60px on phones). The shelf row starts at 96px from the top and scrolls sideways with its scrollbar hidden. The focused title's head sits bottom left (112px from the foot, min(780px, 56vw) wide), the trophy rack bottom right (250px wide, 54px from the foot), and the control legend along the foot (30px up). The left of the frame is the type side: every key art plate is composed with its mass in the right three fifths, and the stage scrims darken the left, the top and a corner behind the bar.

The gutter is clamp(16px, 4.7vw, 72px), and 16px on phones. An opened title or screen is a fixed full-screen layer over the art dimmed to ink at 0.78 to 0.9 alpha, with 120 to 128px of top padding and a left-aligned column up to 760px measured from the gutter. Its sections are split by a hairline with 36px above each. Trophies lay out in auto-fill columns of at least 420px up to 1300px (two at desktop). The profile puts a portrait column of 280 to 420px beside the text; loadout rows are a 180px key and a value. The build screen puts a sticky card column of 280 to 420px beside a control panel up to 760px. Obavia runs a full-viewport hero over fixed art, then a 780px column (1080px for films) on ink at 0.88 alpha, with sticky tabs under the bar.

Spacing recurs at 8px (chip and row gaps), 14px (tag, role and summary inside a title head), 26px (the stat block and section margins) and 34px (before an action row). Obavia's sections pad 64px (46px on phones).

At 899px and below the composition reflows for a phone. Tiles shrink to 76px (96px focused) and snap. The title head sits low and its actions become a lacquer action bar fixed to the foot with a hairline on top. The trophy rack and legend hide. Stats become a two-column grid split by a hairline. The system bar drops the job title, the clock and its nav labels, and the Player 2 slot shrinks to its ring. At 430px and below the level pill, the email item and the trophy count go too, and phones shorter than 700px drop the summary. The desk demo sits beside its steps (a 300px phone and a fluid column) and stacks on phones at 280 by 580.

## Elevation & Depth

Depth is the key art behind and opaque lacquer in front. Raised surfaces are near-opaque lacquer lit by a single bone hairline along the top edge, outlined by a one-pixel black line and seated on a long, soft black shadow. Legibility over art comes from ink scrims laid on the art (linear and radial gradients of ink) and a soft dark text shadow on the largest type, never from blur. A static film grain at 0.05 opacity drifts over the stage in six steps.

### Shadow Vocabulary
- **Lacquer Panel** (`box-shadow: inset 0 1px 0 rgba(237, 231, 219, 0.24), 0 0 0 1px rgba(0, 0, 0, 0.35), 0 18px 40px rgba(0, 0, 0, 0.45)`): the trophy rack, the build preview, Obavia's sent card. Toasts use the same recipe at 0.4 and 0.55.
- **Level Clear** (`box-shadow: inset 0 1px 0 rgba(237, 231, 219, 0.24), 0 30px 80px rgba(0, 0, 0, 0.7)`): the one card that owns the whole screen.
- **Tile Art** (`box-shadow: inset 0 0 0 1px rgba(237, 231, 219, 0.14), 0 10px 24px rgba(0, 0, 0, 0.5)`): every shelf tile.
- **Film Frame** (`box-shadow: 0 0 0 1px rgba(237, 231, 219, 0.14), 0 18px 40px rgba(0, 0, 0, 0.5)`): films and the profile portrait.
- **Card Lift** (`box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55), 0 30px 60px rgba(0, 0, 0, 0.55)`): the build card.
- **Medal Drop** (`filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55))`): every medal raster.
- **Bar Edge** (`box-shadow: inset 0 1px 0 rgba(237, 231, 219, 0.24)`): the phone action bar and Obavia's get bar.
- **Type Over Art** (`text-shadow: 0 2px 30px rgba(0, 0, 0, 0.45)` on logotypes, `0 1px 16px rgba(0, 0, 0, 0.5)` on summaries).

### Named Rules
**The One Hairline Rule.** A raised panel is lit by one bone hairline on its top edge. No border all round, no glow, no coloured edge.

**The Scrim Not Glass Rule.** Over art, legibility comes from ink scrims on the art and from near-opaque lacquer. Never backdrop blur, never a frosted panel.

## Shapes

Square-shouldered, with five radii. **Plate** (3px): buttons, tabs, the stack of skills, matched-term plates, the ask input. **Panel** (4px): menu rows, equip rows, boxed inputs, backdrop swatches, the focus outline. **Frame** (6px): tiles, the trophy rack, toasts, films, the portrait, the build card. **Pill** (20px): status capsules and choice chips (the level, In development, role and lot chips, finishes; the Player 2 slot runs 30px). **Round**: the avatar, medals, the close and deck arrows, the film play button, step counters.

The bullet is an 8px square outline turned 45 degrees. The focused tile wears a 3px bone ring outset 8px (radius 11px) plus two 12px corner ticks, top right and bottom left, outset 14px. The build card's frame is a metal line 0.2cqw thick inset 2.6cqw, with a second one-pixel line at 0.45 opacity inset 0.8cqw further in.

**The Pill Is a Choice or a Status Rule.** Pills are only for things you pick and for status capsules. A button that does something is a 3px plate.

## Components

### Buttons
Squared, quiet and sure.
- **Shape:** a plate (3px), 46px tall, 22px side padding; small 38px, large 54px with 30px padding.
- **Primary:** bone fill, ink text, 148px minimum width. Hover lifts to a warmer white (#fff8ec). One per group: Open, Start, Enter the library, Resume PDF on the profile.
- **Secondary:** transparent with a bone outline at 0.7; hover lays bone at 0.08 and the outline goes full bone.
- **Ghost:** no outline, bone-2 text; hover shows a strong hairline. Back buttons are ghosts with a back glyph.
- **Press:** scale to 0.97. Icons inside are 18px line glyphs.
- **Close and arrows:** 44 to 46px circles with a strong hairline, bone on hover.

### Chips
- **Style:** pill, 40px, 16px padding, lacquer at 0.7, strong hairline, Hanken 500 14px bone.
- **State:** hover takes a bone outline; selected is a bone fill with ink text; press scales to 0.97. Chips are radio groups (one role, one lot problem).
- **Finishes:** the same pill with a 16px metal swatch lit by an inset highlight. A finish not yet earned is dashed, in ash, its swatch at 0.45.

### Inputs / Fields
- **Underline:** transparent, a bone underline, no box. The title screen's name field is 60px at Hanken 500 30px; the build screen's signature is 50px at 22px. Focus thickens the underline to 2px. Obavia's early-access fields underline at bone 0.5, 0.75 on hover, full bone plus a one-pixel shadow on focus.
- **Boxed:** for multiline text (the listing paste, sending the build): ink at 0.7, strong hairline, panel radius, 12px by 14px padding; focus turns the hairline bone.

### Navigation
- **System bar:** transparent over the art, 76px. Left: a 52px round avatar with a strong hairline and soft drop, the name (Hanken 500 18px) over the job title (13px ash), the Level pill (ash label, Cormorant 600 figure), the gold trophy glyph and count, then the Player 2 slot. Right: Resume, Email and Score as text buttons with 19px glyphs (hover underlines the word), then the clock in tabular figures. On Obavia the bar starts transparent and turns solid ink with a bottom hairline once you scroll.
- **Player 2 slot:** a 30px-radius capsule with a strong hairline; a 34px ring (dashed in ash-2 and holding a plus when empty; solid, filled bottle and edged in the finish's metal with the player's initial once built), then a tracked ash label over the build's name. On phones only the ring remains.
- **Tabs:** Hanken 500 15px in ash, bone when active with a 2px bone underline inset 14px. Sticky under the bar on an ink band. Q and E key caps bracket them on a keyboard (LB and RB on a pad); hidden on phones.
- **Control legend:** key caps (a 24px outlined box, 4px radius, Hanken 500 12px) beside their action in bone-2, 28px apart.

### Shelf Tiles
The library row. Square art, 136px (120px for small titles), on a lacquer-raised well with the tile-art shadow; the name sits below in Hanken 16px, with a tag line in ash for a title still in development. The focused tile grows to 162px, its name to 19px at 500, and it wears the bone ring (3px, outset 8px) and two corner ticks; the ring breathes between full and 0.82 opacity every 2.4s. Focus follows the pointer on fine pointers and the arrows on a keyboard. Hover brightens the art a touch.

### Title Head and Stats
Bottom left on the home screen: the logotype, a role line in bone-2, a status pill when the title is in development, the lead summary, then up to two stats split by a strong hairline (Cormorant numeral over an ash caption, at most 240px each), then the actions (Open primary, then Resume PDF and Email me as secondaries). It rises in on arrival.

### Trophy Rack and Medals
Bottom right: a 250px lacquer panel at 0.9 with the lacquer-panel shadow, a plain heading (Trophies in this title, and the count), and rows of a 40px medal beside the trophy name over its tier in bone-2. Medals are minted metal rasters with the medal drop. In lists (the Trophies screen, an open title) medals run 64px with the name in Hanken 500 17px, the tier as a tracked ash suffix after it, and the fact below in bone-2; an unseen trophy's medal is desaturated to 0.35 and dimmed to 0.78.

### Toasts and the Level Clear
- **Toast:** 380px, lacquer, frame radius, the lacquer-panel shadow, sliding in 24px from the right under the bar. A 52px medal coins in (a half turn on its vertical axis) with a sheen passing over it; the trophy name, its tier suffix, then one line in bone-2. A status toast drops the medal and stacks its title over its line.
- **Level Clear:** the screen dims to near-black at 0.86 and a 640px lacquer card rises with a 132px platinum medal, the trophy name as a headline, a line, a portrait and actions centred.

### Title Screen and Menus
The title screen plays on every arrival: full-bleed art on a 30s dolly, the display name, the job line, a breathing PRESS START prompt, Start (primary) and Start muted (a text button), fine print in ash, Skip top right. Its menus (who is playing, then the build step) are stacks of rows: lacquer at 0.74, a hairline, panel radius, a 30px outlined number key, a title in Hanken 500 19px over a bone-2 subline. The focused row is bottle with a bone edge; the picked row flips to a bone fill with ink text. An alternative row (Paste the listing) is dashed. In the build step the menu sits beside a lacquer preview card that strikes its proofs in one by one; on a laptop the sublines hide so the whole list holds one screen.

### Build Card
The signature component. A 4 by 5 card sized entirely in container units, so it reads the same at every width and matches the 1080 by 1350 PNG that build.js draws. Layers, back to front: the key art (focused to the right), an ink shade from the left, Jason's cut-out portrait off the right edge, an ink shade from the foot, the metal double frame in the chosen finish, then the type: the name in Cormorant 600 tracked 0.146em, the job title in ash, the build's class in Cormorant 500 capitals, its line in bone-2, four proofs each with a 7cqw medal, and a foot with the level (tracked ash label over a Cormorant 600 figure) and the signature and date at right. An empty card is lacquer with a dashed hairline frame and a plus.

### Build Screen Controls
The Player 2 screen: the sticky card beside a panel of control groups, each under a label. Role and lot chips (radio pills); equip rows (a two-column grid of 56px rows on lacquer at 0.6 with a hairline, a medal desaturated until equipped; equipped rows go bottle with a bone-2 edge, full-colour medal and a check); backdrop swatches (64px squares, the chosen one framed in bone); finish pills; the signature underline field; then the actions over a hairline.

### Screens
Trophies, Profile and Player 2 open as full pages over the dimmed art with a ghost Back at top left and the system bar's identity hidden. Each heads with a logotype and a bone-2 subline. Profile: a 4 by 5 portrait on a bottle-to-ink well with the film-frame shadow; the level in Cormorant; the bio as a lead; actions; then the Loadout as label and value rows split by hairlines (stacked on phones), never boxed.

### Desk Demo
Handle a Sale as an iPhone app, inside the Lead to Title title and on Obavia. The phone is its own small world: a 300 by 620 handset with a 50px radius and a dark bezel, and inside it a light iOS screen (#f2f2f7 grounds, white grouped lists, iOS system greens for ticks and switches, a dynamic island that widens to report). The library's rules stop at the glass. Screens push in from the right on cubic-bezier(0.32, 0.72, 0, 1) over 0.45s and the scanned licence settles on cubic-bezier(0.25, 0.8, 0.25, 1): curves that arrive and settle with no overshoot. Every buyer and figure is fictional and says so. The steps beside the phone light up as you play: the current step's counter fills bone, done steps fill bottle.

### Motion
- **The ease:** cubic-bezier(0.2, 0.7, 0.1, 1) for every transition and entrance in the library. Hovers and state changes run 0.3s; focus moves 0.36s.
- **Rise:** fade in from 14px below, 0.6 to 0.7s. The title head, the trophy rack (0.1s later), screens, the sent card, lessons.
- **Fade on phones:** where a fixed action bar is present, the title head, screens and the rack only fade, because a transform left on them would capture the fixed bar.
- **Breathe:** opacity between full and 0.82 over 2.4s, symmetrical ease-in-out, looping. The focused tile's ring and PRESS START. On Obavia every focus outline breathes between bone and bone at 0.6.
- **Dolly:** the key art scales from 1 to 1.02 over 20s (30s on the title screen); plates cross-fade over 0.9s.
- **Mint and strike:** the build card arrives in 1.3s, rising 22px from 0.95 scale through a brightness flash to rest; its four proofs strike in from 10px left at 0.55, 0.7, 0.85 and 1s; a soft glint crosses the frame. Changing a build re-mints in 0.6s.
- **Coin and sheen:** a medal turns a half turn into place (0.9s on a toast, 1.4s on the level clear) as a sheen passes.
- **Reduced motion:** loops stop, the dolly, grain, mint, strike and glint are removed, the card shows finished, and transitions shorten to 0.15s.
- **Feedback:** choices, arrivals, sends and unlocks fire sound, haptic and motion in the same frame; skips and cancels make no sound and no haptic.

## Do's and Don'ts

### Do:
- **Do** keep the chrome achromatic: ink grounds, bone for actions and focus, bottle green for held states.
- **Do** name titles, screens and the person in Cormorant Garamond 600 capitals tracked 0.12em, and set everything else in Hanken Grotesk.
- **Do** use the one ease, cubic-bezier(0.2, 0.7, 0.1, 1), for every transition and entrance; keep symmetrical ease-in-out for the 2.4s breathe loop only.
- **Do** raise a panel with the lacquer recipe: near-opaque lacquer, one bone hairline on the top edge, a long soft black shadow.
- **Do** compose key art with its mass to the right and calm shadow on the left for type, graded through the one recipe (tools/art/grade.py), with no people, readable text, signage, logos or neon.
- **Do** size the build card in container units so the page and the 1080 by 1350 PNG are the same card.
- **Do** let phone entrances fade only wherever a fixed bar sits on screen.
- **Do** honour reduced motion: stop the loops, the dolly, the grain and the mint, and show every scene finished.

### Don't:
- **Don't** add a chromatic UI accent: no red, no blue links, no coloured buttons. The retired dash's needle red does not come back, not even inside the desk demo.
- **Don't** put a metal on anything that is not a trophy or the build card's finish.
- **Don't** use backdrop blur, frosted panels or a gradient on text.
- **Don't** set a small tracked label above a headline as a kicker.
- **Don't** round a button into a pill, or square off a choice chip.
- **Don't** let anything bounce or overshoot, including the desk demo's iOS screens.
- **Don't** use a font other than Cormorant Garamond and Hanken Grotesk.
- **Don't** use em dashes, en dashes, emoji as icons, or three-card rows.
- **Don't** let the proof pages' gold accent and springs, or the resume pages' print sheet, leak into the library.
