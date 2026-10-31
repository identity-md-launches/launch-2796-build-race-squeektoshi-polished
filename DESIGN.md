# Race Squeektoshi design system

## Overview

The game is an amber pixel arcade built around a real hamster wheel. The single visual idea is a small night-time racetrack inside a dot-matrix cabinet: original stepped hamster art, a wheel, a quiet moon, and clear game controls. The first phone screen contains the opponent, game mode, settings, and start action. Wheel telemetry shows pace, cumulative turns, rpm and the scheduled round. Data supports play.

The source of truth is `src/styles.css`, with original drawing geometry and palette in `src/art.ts`. The shell and hash navigation live in `src/App.tsx`; the shared control patterns live in `src/components.tsx`.

## Colors

One intentionally dark theme, using canonical hex tokens in `:root` of `src/styles.css`:

| Token | Value | Implemented role |
| --- | --- | --- |
| `--bg` | `#0e100e` | Page and input background |
| `--surface` | `#181c16` | Console, scoreboards, forms, result and empty states |
| `--raised` | `#23291e` | Neutral hover state and disabled controls |
| `--text` | `#f0eddc` | Primary text |
| `--muted` | `#a5aa98` | Supporting text, source labels, inactive controls |
| `--line` | `#383f2f` | Structural separators and cabinet border |
| `--control` | `#626f51` | Field outlines and distinct neutral controls |
| `--amber` | `#ffd16b` | Main action, pixel headline, game emphasis |
| `--amber-hover` | `#ffe2a0` | Primary action hover/press |
| `--amber-dark` | `#302919` | Selected control and earned badge background |
| `--mint` | `#b4d7c5` | Player bandana, stamina, connected indicator |
| `--error` | `#f2aa94` | Field errors and exhausted stamina |
| `--focus` | `#fff0c5` | Keyboard focus outline |
| `--ink` | `#1c2117` | Dark text on amber actions |

Artwork has a separate illustrative palette: `#131710` sky, `#20271a` LED dots, amber/brown wheel spokes, cream/gold hamster fur, and pink cheeks. These values are art materials rather than alternate UI tokens. The mobile scene reserves a solid strip above the canvas for status text. Race lane labels have an opaque sky background so character positions cannot reduce their contrast.

The rendered taste probe measured the hero at **13.27:1**, supporting introduction text at **8.01:1**, source labels on the console at **7.24:1**, the primary button at **11.40:1**, and wheel-state text at **10.32:1**. These are identified rendered pairs, not an estimate for every pixel in the canvas. Details and remaining unmeasured art overlays are in the validation report.

## Typography

Two locally bundled WOFF2 families, imported by `src/main.tsx`:

- **Silkscreen 400**: game headline, small brand wordmark, timers, selected display numbers. It draws uppercase-looking pixel glyphs while source text remains in natural case. The font package also supplies a small WOFF fallback.
- **DM Sans Variable**, normal 100–1000 available, with **400, 500 and 600** used: body copy, controls, labels, data and subordinate headings. Fallbacks are a locally available Arial face adjusted to 101%, then sans-serif. There is no remote font request.

The six sizes are `--text-xs: 12px`, `--text-sm: 14px`, `--text-base: 16px`, `--text-lg: 24px`, `--text-xl: 32px`, and `--text-display: 56px`. The desktop home headline is 56px; it becomes 32px at 800px. Other page headlines are 32px, with the mobile race heading 24px. Subordinate headings are 24px and 16px. Fields stay at least 16px; the prediction number is a deliberate 32px display input.

Body line-height is 1.5, help prose 1.6, headings generally 1.2, the large home title 1.15 and phone title 1.18. Display tracking is −0.055em at home and −0.045em for 32px page titles; the small race title uses −0.025em. Normal prose and labels use natural tracking. Heading wrapping is balanced, prose uses pretty wrapping, and help paragraphs are capped at 65ch. Changing numbers use tabular figures. Mobile scoreboard labels reserve 36px so all three values share a baseline. Nicknames wrap and are isolated with `bdi`; critical text is not ellipsized.

## Layout

The shell is at most 1344px wide including 48px inline padding; it centers in larger viewports. The header is 100px high on desktop and places the brand at the leading edge and help/sound at the trailing edge. The main content starts 36px below it. Spacing primarily uses 4px multiples, with 8–12px within controls, 16–24px between related controls and 32–64px between major groups. Existing 18/22/28px component insets are optical adjustments, not a second spacing system.

The home cabinet uses `minmax(0, 1fr) 372px`: art at the leading edge, console at the trailing edge. The stage’s height follows the console, with an 82px telemetry strip and a reserved 44px status strip. Race pages use a flexible arena and a 324px control rail. Predictions, results, profiles and help use their own simple two-column arrangements while sharing edges, type and control tokens.

Implemented breakpoints:

| Maximum width | Adaptation |
| --- | --- |
| 1100px | Shell padding 28px; console 340px; race rail 300px; tighter secondary layouts |
| 800px | Desktop nav gives way to profile/help/sound utilities; cabinet, race and predictor stack; console/race settings can still use two columns; badges use two columns |
| 520px | Shell padding 16px; header 72px; explicit two-line home headline; compact 210px wheel stage; console/settings and race controls stack; badges use one column; 60px telemetry strip |
| 359px | Shell padding 12px; smaller brand; compact utilities; redundant feed-label text hides while wheel-state text remains |

The supported minimum is 320px. Views at 320, 390, 800 and 1440 were rendered and checked for document overflow. At 390 × 844, the home start button is fully visible on the first screen. Forms and text remain in normal flow; there is no fixed action bar covering content. Long history tables scroll within named, keyboard-focusable regions. DOM order follows the visible interaction order.

## Elevation & Depth

The interface is flat: cabinet boundaries and row separators communicate structure; surface tones group controls. No card has both border and shadow, and there are no nested decorative cards or gradient text. The canvas supplies scene depth through simple pixel silhouettes. Countdown and pause states use an overlay only inside the race arena; they do not create a document-wide modal or steal background keyboard focus. The countdown overlay is translucent; a paused/interrupted state is opaque for legibility.

## Shapes

Controls and fields use a 3px radius; large functional sections use 4px, the cabinet 5px. The main action uses a darker 3px bottom border for a tactile arcade edge; the tap button uses 4px. Badges and the profile avatar have stepped polygons. LED dots, wheel marks and sprite pixels are square. Avoid adding pill-shaped labels or soft floating cards that compete with the cabinet.

## Components

| Component/pattern | Source | Use and behavior |
| --- | --- | --- |
| Shell, brand, navigation | `src/App.tsx` | Hash links; current-page state; native utility links/buttons; skip link; route focus to `main` |
| `Icon`, `HamsterMark` | `src/Icons.tsx` | Original 24px icons at a consistent 1.7px stroke; decorative SVGs hidden from assistive technology; a 32px pixel hamster mark |
| `Scene` | `src/Scene.tsx`, `src/art.ts` | Home/race variants; running, idle and sleep art; actual/recorded wheel rate; responsive canvas at DPR capped at 2; display-scheduled animation; decorative `aria-hidden` canvas with game facts in HTML |
| Primary/secondary/text/icon buttons | `src/styles.css` | One amber primary action per task; neutral secondary actions; explicit hover, pressed, disabled, busy and focus states; no `transition: all` |
| `DurationPicker` | `src/components.tsx` | Native fieldset, legend and three pressed-state buttons for 30/60/600 seconds; the selected state has text and color |
| `GhostPicker`, `PaceSource` | `src/components.tsx` | Labeled native select; recorded/cached provenance and date; unavailable measurements fall back transparently to the real bundled snapshot |
| `FeedNotice` | `src/components.tsx` | Clear connecting/offline status and retry action; live telemetry uses dashes when unavailable |
| Race controls | `src/Race.tsx` | Named progress bar and stamina percentage; decorative beat cue; large touch button; Space/arrows; ignored repeats; ghost pause/resume; live interruption; five-second announcements |
| Prediction form | `src/Predict.tsx` | Connected number/range inputs; inline actionable validation; explicit save/update and lock states; pending/resolved/unverified history |
| Profile and badges | `src/ProfilePage.tsx`, `src/profile.tsx` | Editable nickname/unlocked title; clearly local totals/bests; twelve earned/locked states with icon and text; useful empty states |
| Results and sharing | `src/Race.tsx`, `src/components.tsx` | Focused result heading; compared game distances; point breakdown cues; replay; clipboard copy with selectable-text fallback |

Keyboard focus is a 2px `--focus` outline, normally offset 4px; segments inset it to prevent clipping. Native controls handle their normal keyboard behavior, and every icon utility has an accessible name. Touch targets generally reach 44px; compact mode tabs and footer links retain at least the measured 24px-or-spacing baseline. High-frequency transitions are 80–120ms. Press feedback uses scale 0.96 and is removed under reduced motion. Hover changes are gated by `(hover: hover)`.

Reduced motion stops decorative drawing changes and removes the beat marker while preserving simulation, numeric feedback and controls. Sound is opt-in, synthesized with Web Audio in `src/sound.tsx`, and starts muted. Forced-colors mode preserves system focus and control borders.

## Do’s and Don’ts

- Start an additional page inside the existing shell and hash-route list, using `page-heading`, the shared field/button styles, and the six-size scale.
- Keep a play action near the product. Put instructions next to their control and keep API provenance next to hamster values.
- Reuse recorded/cached/local labels; never present a replay, fallback, or player score as a live hamster observation.
- Keep the pixel treatment in display type and artwork; use readable DM Sans for instructions and forms.
- Keep input text at least 16px and maintain visible, unclipped focus. Give new errors a recovery action and a programmatic announcement.
- Use existing amber/mint/error roles, structural borders and flat surfaces. Avoid adding another accent, font, type size, glow system or decorative card layer.
- New motion must have a reduced-motion equivalent and a static cue. Match existing short transitions; use the native platform before adding a component dependency.

Review guidance: Jakub Krehel’s Better Interface, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method adapted from Paul Bakaus’s Impeccable, Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. The preserved combined license text is `artifacts/design-guidance-license.txt`. These are design references; the game’s source and artwork are specific to this assignment.
