---
name: jasonobawemimo.com
description: The instrument cluster of the car Jason drives to work. Facts are gauges, actions live on the center screen, and the desk he built rides a phone mount.
colors:
  needle: "#e8553b"
  needle-bright: "#f27258"
  needle-wash: "rgba(232, 85, 59, 0.1)"
  needle-painted: "#e0442a"
  lamp-green: "#3bd16f"
  lamp-amber: "#f2a33a"
  brass: "#c9a642"
  lacquer: "#131211"
  deep: "#0b0a0a"
  seam: "#0a0909"
  panel: "#1b1917"
  panel-raised: "#23201d"
  hood: "#221f1b"
  leather: "#1d1a17"
  leather-low: "#161412"
  edge: "#2e2a26"
  edge-strong: "#3d3833"
  screen: "#0c0c0e"
  key: "#1d1e21"
  key-raised: "#27282c"
  ivory: "#efe8d8"
  ivory-soft: "#cfc8b9"
  dim: "#a39c8f"
  ink: "#161514"
  stitch: "#a0622d"
  dial-shade: "#d9d1bf"
  chrome-hi: "#eef0f2"
  chrome-mid: "#9a9ea3"
  chrome-lo: "#44484d"
  phone-paper: "#f2f2f7"
  phone-ink: "#111111"
  phone-secondary: "#8a8a8e"
  phone-separator: "#d8d8dc"
  phone-green: "#34c759"
typography:
  display:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(34px, 5vw, 52px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(24px, 3.4vw, 32px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(22px, 2.4vw, 28px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  lead:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "clamp(18px, 2vw, 21px)"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "0.005em"
  item:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1.25
  button:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
  label:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0"
  readout:
    fontFamily: "Hanken Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  badge:
    fontFamily: "Cormorant Garamond, Garamond, serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  tile: "10px"
  dock: "12px"
  row: "14px"
  key: "18px"
  screen: "22px"
  console: "28px"
  phone: "50px"
  pill: "999px"
  round: "50%"
spacing:
  hair: "6px"
  tight: "10px"
  base: "14px"
  card: "22px"
  section: "44px"
  gutter: "clamp(14px, 2.6vw, 36px)"
components:
  button-primary:
    backgroundColor: "{colors.needle}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.needle-bright}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.key}"
    textColor: "{colors.ivory}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
    height: "44px"
  key:
    backgroundColor: "{colors.key}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.key}"
    padding: "14px"
    height: "92px"
  key-hover:
    backgroundColor: "{colors.key-raised}"
  key-start:
    backgroundColor: "{colors.needle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    padding: "14px"
    height: "92px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  chip-on:
    backgroundColor: "{colors.needle-wash}"
    textColor: "{colors.needle-bright}"
  display-screen:
    backgroundColor: "{colors.screen}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.screen}"
    padding: "14px 18px 12px"
  carplay-screen:
    backgroundColor: "{colors.screen}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.console}"
    padding: "10px"
  story-card:
    backgroundColor: "{colors.leather}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.screen}"
    padding: "18px 22px 24px"
  grouped-list:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.screen}"
    padding: "12px 16px"
  app-tile:
    rounded: "{rounded.tile}"
    size: "40px"
  input:
    backgroundColor: "{colors.lacquer}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  tab-bar:
    backgroundColor: "#0e0d0c"
    textColor: "{colors.dim}"
    typography: "{typography.label}"
  phone-screen:
    backgroundColor: "{colors.phone-paper}"
    textColor: "{colors.phone-ink}"
    rounded: "{rounded.phone}"
    width: "300px"
    height: "620px"
---

# Design System: jasonobawemimo.com

## Overview

**Creative North Star: "The Instrument Cluster"**

The site is the dashboard of the car Jason drives to work, at night, with the ignition on. Facts are gauges with ivory faces and one red needle. What is true right now is a tell-tale lamp. Every action lives on a CarPlay screen, and the sale desk he built is a real iPhone on a dash mount that a visitor can run. The world is physical and specific: black dash leather with cognac stitching, brushed-chrome bezels, screens recessed into black seams, a signal-red needle. It refuses the dark portfolio hero with a showreel and a list of case studies.

Density is that of a cockpit: compact, everything in reach, the first viewport holds the whole story (who, what is true, whether Triple J is open, what to press). Type is one grotesque, heavy and tight at the top, sentence case everywhere, numerals tabular as they would be on a cluster. Depth is real: hardware casts shadows, screens sit inside bezels, leather carries a stitched seam. Motion borrows two grammars at once, the needle's damped ignition sweep and iOS springs for presses, sheets and pushes.

The Obavia page (/obavia.html) is the same world shaped as an App Store product page: a chrome-bezeled icon, an at-a-glance strip under a stitched hood, films in bezels, grouped lists, and a get bar. The films (tools/film/src/dash) render from the same palette and springs.

**Key Characteristics:**
- One accent: needle red. Green and amber appear only as lamps that mean something.
- One face: Hanken Grotesk, with Cormorant Garamond only on the JO badge.
- Hardware, not cards: dials, a multifunction display, a CarPlay screen, a phone on a mount.
- Recessed screens with stacked bezel rings instead of borders.
- Stitched seams on leather surfaces.
- iOS behavior on every control: sentence case, springs, press scale, sheets with a grabber.

## Colors

A near-black warm cabin lit by ivory text, one signal-red needle, and two tell-tale lamps; everything else is leather, chrome and glass.

### Primary
- **Signal Needle Red** (needle): the only accent. Primary buttons, the start key, the cut app tile, the current step marker, the open-story lead emphasis, the gauge red sector. Text on it is Dash Ink, never ivory.
- **Lit Needle** (needle-bright): the needle under light. Hover state for every needle surface, link hover, the active tab, focus rings, emphasis words on dark, dates in the record.
- **Needle Wash** (needle-wash): the pressed or selected chip fill only.
- **Painted Needle** (needle-painted): the physical needle and red sector on ivory gauge faces, in the live gauges and in every film. Not a UI color.

### Secondary
- **Open Lamp Green** (lamp-green): lit only when Triple J is open right now, and as the tick on verified checks. A glowing drop-shadow (0 0 6px at 0.55 alpha) comes with it.
- **Amber Tell-Tale** (lamp-amber): means "in development". The Obavia lamp and the first at-a-glance value on the Obavia page. Never decorative.

### Tertiary
- **Badge Brass** (brass): the italic JO on the badge, and nothing else on the site. The films keep it as their gold too.

### Neutral
- **Dash Lacquer** (lacquer): the page and the html background; a dome light (a radial of #2b2622 at the top) warms it on dash pages.
- **Deep** (deep) and **Seam Black** (seam): film letterbox, poster fallbacks, and the black gap between a screen and its bezel ring.
- **Panel** (panel) and **Panel Raised** (panel-raised): grouped lists, drawers, the current step row.
- **Hood**, **Leather**, **Leather Low** (hood, leather, leather-low): the shaded leather of the cluster hood, the story cards, the closing card and the Obavia cards. Always a vertical shade from light to low.
- **Edge** and **Edge Strong** (edge, edge-strong): hairlines, the outer bezel ring, scrollbar thumb, secondary button border.
- **Screen Glass** (screen): the multifunction display and CarPlay.
- **Key** and **Key Raised** (key, key-raised): CarPlay keys, secondary buttons, pills, the menu button.
- **Ivory** (ivory): primary text and the gauge faces. **Ivory Soft** (ivory-soft): secondary text and sublines. **Dim** (dim): captions, labels, idle lamps text, inactive tabs.
- **Dash Ink** (ink): text on needle red and on ivory faces; gauge ticks and numerals.
- **Cognac Stitch** (stitch): seams, at 0.45 to 0.5 alpha as a dashed line, and the 0.28 to 0.3 alpha line under the compact top bar and over the tab bar.
- **Chrome** (chrome-hi, chrome-mid, chrome-lo) and **Dial Shade** (dial-shade): bezel and gauge-face materials, drawn as gradients on hardware only.
- **Phone** (phone-paper, phone-ink, phone-secondary, phone-separator, phone-green): the light iOS world inside the mounted iPhone. These never leave the phone screen.

### Named Rules
**The One Needle Rule.** Needle red is the only accent, and one red element leads each view. If two things on screen are red, one of them is wrong.

**The Lamp Truth Rule.** Green and amber are tell-tales, so they carry state: green is open now, amber is in development, an unlit lamp is #4b4641. Never use either as decoration or as a second accent.

**The Brass Badge Rule.** Brass lives on the JO badge. Every other "gold" in the stylesheets resolves to the needle on dash pages; do not reintroduce brass anywhere else.

## Typography

**Display Font:** Hanken Grotesk (with Helvetica Neue, Helvetica, Arial)
**Body Font:** Hanken Grotesk
**Badge Font:** Cormorant Garamond italic 500, on the JO badge only

**Character:** One grotesque doing everything, the way a car's cluster and its head unit speak one face. Heavy (800) and tightly tracked at the top, medium and open in the body, tabular for anything that counts.

### Hierarchy
- **Display** (800, clamp(34px, 5vw, 52px), 1, -0.035em): the closing "Your move." and the intro's question and cards (up to clamp(38px, 7vw, 66px)).
- **Headline** (800, clamp(24px, 3.4vw, 32px), 1.05, -0.025em to -0.03em): the name on the display, Obavia page section heads.
- **Title** (800, clamp(22px, 2.4vw, 28px), 1.1, -0.025em): story card titles and in-story heads (clamp(21px, 2.6vw, 27px)).
- **Lead** (500, clamp(18px, 2vw, 21px), 1.5, max 44ch): the first paragraph of an open story; its strong words take Lit Needle.
- **Body** (400 to 500, 14px to 15.5px, 1.45 to 1.62, max 58 to 62ch): sublines, list text, page copy.
- **Item** (700, 14.5px, 1.25): app rows, keys (15px), grouped-list titles (600, 15px).
- **Label** (600, 12px to 13px, sentence case, no tracking): display rows, captions, tabs (11px).
- **Readout** (800, 21px, tabular): gauge readouts; the desk odometer is 700 at 52px.

### Named Rules
**The One Face Rule.** Hanken Grotesk everywhere. Cormorant Garamond appears only inside the JO badge. On dash pages the serif token is remapped to the sans, so any inherited serif heading renders as Hanken.

**The Sentence Case Rule.** Buttons, keys, tabs, labels and chips speak sentence case with zero tracking, like an iPhone. Uppercase appears only where the hardware prints it: the label on a gauge face.

**The Tabular Rule.** Every number that can change (clock, gauges, odometer, money, counts) is set with tabular numerals.

## Layout

The home page is one cabin, max 1280px wide, centered, with a side gutter of clamp(14px, 2.6vw, 36px) and room above for a 56px top bar. Inside it, in order: the cluster (a three-column hood, 1fr / 1.3fr / 1fr: courses dial, display, GPA dial; lamps centered beneath), the console (CarPlay 1.75fr beside the phone mount 1fr, 26px below), the stories feed (two columns, 22px gap, wide stories span both, 48px below), the closing card (44px below), and the credits.

Spacing steps are 6, 10, 14, 22 and 44px, with 8, 12 and 18 used inside components. Cards pad 18 to 24px; screens pad 10 to 18px.

Below 900px the tab bar appears (74px reserved at the bottom), the console stacks and the feed becomes one column. Below 700px the cluster becomes display first with the two dials side by side under it (132px each), lamp sublines hide, CarPlay drops its status bar and dock, keys shrink to 64px, and app rows go single column, so name, dials, lamps and the four actions sit above the fold.

The Obavia page is a single column (max 1040px, 16 to 28px gutter): header with icon, a hero film in a bezel, the at-a-glance strip that scrolls sideways on phones, then sections 44px apart, and a fixed get bar (460px centered from 900px up).

Breakpoints in use: 380, 560, 700, 760, 900 and 980px.

## Elevation & Depth

Depth is physical. Hardware casts long soft shadows onto the dash, screens are recessed into bezels built from stacked spread shadows, and leather surfaces carry an inner top highlight and a low inner shadow. Nothing floats on blur; overlays are opaque.

### Shadow Vocabulary
- **Bezel ring** (`box-shadow: 0 0 0 1px #26262a, 0 0 0 6px #0a0909, 0 0 0 7.5px #3d3833, inset 0 0 36px rgba(0, 0, 0, 0.7)`): the display screen. CarPlay uses 1.5 / 8 / 9.5px plus a 0 30px 60px drop; film frames use 1px edge-strong plus a 6px seam.
- **Hood** (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -18px 30px rgba(0, 0, 0, 0.35), 0 30px 60px rgba(0, 0, 0, 0.45)`): the cluster and the at-a-glance strip.
- **Hardware drop** (`box-shadow: 0 24px 50px rgba(0, 0, 0, 0.4)` to `0 40px 80px rgba(0, 0, 0, 0.55)`): story cards, the phone, the get bar.
- **Gauge drop** (`filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.55))`): the dials.
- **Lamp glow** (`filter: drop-shadow(0 0 6px rgba(59, 209, 111, 0.55))`, amber at 0.45): only on a lit lamp.
- **Stitch line** (`box-shadow: 0 1px 0 #0a0909, 0 2px 0 rgba(160, 98, 45, 0.28)`): the top bar once compact, mirrored over the tab bar.

### Named Rules
**The Bezel Rule.** A screen never takes a plain border. It sits in rings: a hairline, a black seam, an edge.

**The Opaque Rule.** Backdrops are opaque washes (rgba(8, 7, 7, 0.86)); no backdrop blur, no frosted glass, anywhere.

**The Material Gradient Rule.** Gradients are materials: chrome on bezels and the badge, a vertical shade on leather, a radial on gauge faces, a dome light on the page. They never touch text.

## Shapes

Shape follows the object it imitates. Dials, lamps, the portrait and the badge are round. Screens are 22px (display, story cards, grouped lists, get bar) to 28px (CarPlay). Keys are 18px, row highlights 14px, dock apps 12px, app tiles 10px. Buttons, chips, pills and inputs are full pills. The iPhone is 50px outside and 40px at the screen. Sheets on phones round only the top corners (22px) and carry a 38 by 5px grabber.

Leather surfaces carry the seam: a 1.5px dashed Cognac Stitch line inset 7 to 8px, its radius the parent's minus 6. The cluster hood is the one asymmetric silhouette, a cowl of 56px 56px 30px 30px / 70px 70px 30px 30px.

## Components

### Buttons
Tactile and plain-spoken, iPhone buttons on a dash.
- **Shape:** full pill (999px), 44px minimum height (36px small).
- **Primary:** Signal Needle Red with Dash Ink text, 600 14px sentence case, 11px 22px padding. Hover goes to Lit Needle.
- **Secondary:** Key fill, Edge Strong border, Ivory text; hover turns the border needle red.
- **Press:** springs to scale 0.95 in 0.12s, releases on the spring curve; hover lifts 1px.
- **Text link:** Ivory Soft, 13px, underline in Edge Strong offset 5px; hover goes Lit Needle.

### Keys (CarPlay)
- Four across, 92px tall (64px on phones), 18px radius, Key fill, icon top-left 26px, 700 15px label bottom. The first key, Resume, is the start key in needle red; it is the view's one red element.

### Chips
- **Style:** transparent pill, Edge border, Ivory 600 14px, 40px tall.
- **State:** hover borders needle; pressed fills Needle Wash with Lit Needle text. Chips are a sentence of choices, never a grid.

### Cards / Containers (story cards)
- **Corner Style:** 22px.
- **Background:** Leather to Leather Low, vertical.
- **Shadow Strategy:** hardware drop; see Elevation.
- **Border:** none; the stitched seam inset 8px.
- **Internal Padding:** 18px 22px 24px under a 16:9 looping film (21:9 for wide cards on desktop).
- **Open:** the card itself expands to fill the screen on a soft spring (0.62s), the body rises 18px, a 36px round close sits sticky top-right, and the page behind gets the opaque backdrop.

### Grouped lists
- iOS settings grouping: Panel fill, 22px radius, Edge hairlines between rows, rows padded 12px 16px with a 34px app-icon square on the left and a dim chevron on the right. Facts that are not live yet sit in their own group under a heading that says so.

### Inputs / Fields
- **Style:** the ask box is a pill input on Lacquer with an Edge border, 44px tall. The early-access form uses underline fields (Edge Strong bottom border, 16px text).
- **Focus:** the border or underline turns needle red; caret is needle red in the intro.
- **Error:** status text in a muted rose (#d9a0a0) below the form.

### Navigation
- **Top bar:** transparent over the cluster with the badge left and round sound and menu buttons right; on scroll it turns opaque Lacquer with the stitch line and the title fades in.
- **Tab bar (phones under 900px):** five tabs, 24px icons over 600 11px labels in Dim; the active tab is Lit Needle; it slides away while a story is open.
- **Menu:** a full-screen opaque sheet of large rows with small dim hints and two chips (Sound, Still).

### Gauges (signature)
- 200 by 200 viewBox: a chrome bezel ring, a black seam, an ivory face shaded to Dial Shade, ink ticks (major 2.6px, minor 1.2px) and 700 14px numerals, a 700 8.6px tracked uppercase label, a 800 21px tabular readout, a Painted Needle with an ink tail and a chrome hub. On load the needles sweep to the stop and settle on the value with a damped overshoot (1.2s). A caption under each dial gives the number in 800 Ivory and the meaning in Dim.

### Tell-tale lamps (signature)
- A 22px line icon and a two-part label (bold Ivory word, Dim subline). Unlit icons are #4b4641; lit ones take their real color and glow. Lamps are status first, links second.

### Multifunction display (signature)
- Screen Glass in the bezel ring, a 12px status row (date, clock) over a hairline, a 72px round portrait with a chrome ring, the name in headline weight, a line in Ivory Soft, and a definition list of facts on 5.4rem label columns.

### Phone on the mount (signature)
- A 300 by 620px iPhone with a dynamic island that springs wide on events, a light iOS screen (phone tokens), screens that push in on cubic-bezier(.32, .72, 0, 1) over 0.45s, and a black mount arm behind. Its caption states that the buyer is fictional and the figures are examples; that caption is part of the component.

## Do's and Don'ts

### Do:
- **Do** let exactly one needle-red element lead each view; make every other action a Key or a secondary pill.
- **Do** set every changing number in tabular numerals.
- **Do** recess screens in bezel rings and give leather surfaces the stitched seam inset 7 to 8px.
- **Do** follow the radius ladder: round for dials and lamps, 22 to 28px screens, 10 to 18px keys and tiles, pills for buttons.
- **Do** write controls in sentence case with zero tracking.
- **Do** use the shared easings: ease cubic-bezier(0.16, 1, 0.3, 1), spring cubic-bezier(0.34, 1.56, 0.64, 1), press scale 0.95 in 0.12s; collapse all motion to 1ms under Still or reduced motion.
- **Do** fire sound, haptic and motion in the same frame for choices, arrivals, sends and unlocks; skips and cancels stay silent and still.
- **Do** label fictional people and example figures on every demo surface.

### Don't:
- **Don't** add a second accent, and don't use lamp green or amber for anything but their state.
- **Don't** use brass anywhere but the JO badge.
- **Don't** set anything in Cormorant Garamond outside the badge, or in any third face.
- **Don't** put gradients on text, blur behind a surface, or frost a sheet.
- **Don't** use em dashes in any copy.
- **Don't** lay three cards in a row, or use emoji as icons; icons are inline SVG line glyphs.
- **Don't** give a screen a plain 1px border in place of its bezel.
- **Don't** let the phone's light iOS colors leak onto the dash.
