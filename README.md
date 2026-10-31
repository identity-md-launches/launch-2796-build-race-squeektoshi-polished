# Race Squeektoshi

A browser rhythm game against Squeekchain’s real hamster. Play a live race when the wheel is moving, chase a recorded ghost at any time, or predict the next round’s wheel turns. No wallet, account, backend, tokens, or transactions are needed.

The finished static export is in **`dist/`**. The source is React + strict TypeScript + Vite. All artwork, sprite animation, icons, sound synthesis, and the share image are original to this game. Fonts are bundled locally with their licenses.

## Install, preview, and rebuild

Use Node 22 (validated with 22.23.3) and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run check:export
npm run preview
```

Open the preview URL printed by Vite. `npm run dev` starts the source development server. A rebuild replaces `dist/`; the supplied export is already built. `npm ci` requires network access, but the production game has no dependency on an npm registry.

Optional rendered validation:

```sh
npx playwright install chromium webkit
npm run check:browser
```

Browser checks create only `test/scratch/browser-check/` and shut down their temporary preview and browser processes. Playwright may need operating-system libraries on Linux. These tools are development dependencies and are absent from the static export. `node scripts/make-og.mjs` regenerates the original 1200 × 630 PNG using the same hamster drawing functions and an original bitmap alphabet; it needs Node 22+, no image library or network.

For this assignment dependencies were installed and builds run in an isolated `/tmp` copy to avoid creating `node_modules/` in the submission repository. Source, manifest, lockfile, tests and export were synchronized back. The normal commands above work in a conventional local checkout.

## Deploy to IPFS or a static host

Pin or upload the **contents of `dist/` as one directory**, preserving its `assets/` and `licenses/` directories. Serve `index.html` at that directory’s root. No server rewrites or build service are required. Vite uses `base: './'`; script, stylesheet, font, icon, and image URLs are relative. Navigation uses only hashes, so the game also works at a gateway path such as `/ipfs/<directory CID>/` or a deeper subpath. The browser validation actually serves the export under a nested IPFS-shaped path with no route fallback.

Routes: `#/`, `#/race`, `#/ghost`, `#/predict`, `#/profile`, `#/how-to-play`. Metadata includes a title, description, SVG favicon, Open Graph fields, and a Twitter large-image card. The OG image URL stays relative because the publisher assigns the final gateway URL.

## Playing and scoring

Choose a **30-second sprint**, **60-second chase**, or **600-second full-round race**. Race distances are game distances in meters; timed races compare distance at the finish. A full-round race starts with your countdown and need not coincide with a chain round.

- Press Space or any arrow key, or use the large touch button. Holding a key does not repeat taps. The button also supports screen-reader activation.
- Aim for one tap every half second. Timing quality is measured against the preceding tap; the first tap establishes the rhythm. The marker crosses the center twice a second. Perfect taps build a streak.
- Stamina regenerates during play. Rapid taps cost much more stamina and have low timing quality, so mashing loses to a steady rhythm. Speed eases toward the quality/stamina target and decays when you stop tapping.
- Ghost races pause and resume; leaving the tab pauses them automatically. Live races interrupt on a lost/stale feed or a hidden tab, and need a restart. Interrupted/abandoned races receive no result or points. A resting wheel during a connected live race slows the opponent to zero.
- A finish earns 50 local points, plus `floor(player meters)`, plus two per perfect tap. Winning adds 100; a 600-second finish adds 150. Bests are kept separately by live/ghost mode, ghost opponent, and duration.

**Ghost opponents are recorded, constant-pace recreations**, not turn-by-turn replays:

| Opponent | Real measurement used | Game pace |
| --- | --- | --- |
| Daily squeek | 7-day `rounds.medianActiveWork` | turns × 0.88 / 600 m/s |
| Personal pest | 30-day `rounds.mostActiveWork` | turns × 0.88 / 600 m/s |
| Rocket paws | 30-day `records.peakObservedSpeedMmPerSecond.value` | value / 1000 m/s |

The peak ghost deliberately holds the observed peak for the whole game race; it does not claim that the hamster sustained it. Source dates and recorded/cached labels are shown. Typical pace refers to **active rounds**, not a claim that the hamster runs all day. Resting rounds may have zero work.

Live opponent speed is `measurement.speedMmPerSecond / 1000`, smoothed with a 1.2-second exponential response and integrated by the simulation. Its distance is therefore explicitly labeled a **live pace estimate** from sampled speeds. It is not claimed to be the hardware counter’s exact distance during the race. The wheel animation uses live `rpmMilli / 1000`; the recorded wheel uses the equivalent turn rate. The game uses the supplied approximation of **1 turn = 1 work unit ≈ 0.88 m**.

## Round predictor: exact resolution method

1. **Schedule.** `/v1/status` does not expose a current-round field in the observed schema. The schedule comes from `/v1/settlements?range=24h` → `mining.nextRound.{round,startsAt,endsAt}`. The observed boundary pair is exactly 600 seconds apart. With boundary round `r` starting at `s`, current round is `r + floor((serverNow - s) / 600000)` and the prediction targets the following round. The status API’s `generatedAt` anchors the browser clock. The schedule is accepted only with a fresh status, a successful settlement read, matching `installationId`, and a valid 600-second boundary pair.
2. **Save and lock.** The slider and number field save an integer guess, installation ID, round number, start/end timestamps and save time in the local profile. A guess can be edited until `startsAt`. Submission checks the current server-adjusted clock again, rather than trusting the last visible countdown tick. The next-round form advances at the boundary; the saved call becomes locked. Stored entries whose `savedAt >= startsAt` are rejected on load.
3. **Evidence.** Read `recentSettlements[]` from the settlement endpoint and `events[]` of type `system.settlement_completed` from the events endpoint. Both carry `previousSettledThroughRound`, `settledThroughRound`, `workAdded`, and `cumulativeWork`; events obtain confirmation status from `source.confirmationStatus`. Only **safe or finalized** records for the same installation count.
4. **Exact work.** For prediction round `q`, accept `workAdded` when `previousSettledThroughRound = q−1` and `settledThroughRound = q`. Also accept zero from a safe settlement spanning `q` whose whole `workAdded` is zero, since every constituent round’s work is nonnegative. Otherwise, if safe records give cumulative work exactly at boundaries `q−1` and `q`, use their nonnegative difference. Contradictory evidence fails closed. **Never divide a nonzero multi-round aggregate, a daily total, or an activity bucket into guessed round work.** Hardware cumulative measurements are not sampled exactly at boundaries and are not used for prediction scoring.
5. **Return visits.** Pending calls are loaded at startup and reconciled whenever current settlement/event data arrives. They wait through settlement delay; after two hours past the end without exact evidence, they say **“Could not verify”** and award no points or streak penalty. Such entries remain eligible for later verification when evidence exists. A resolved call is never awarded twice. The API only supplies a recent window (the events request has 20 entries and recent settlements may emphasize active rounds), so old calls may remain unverifiable. Retain the last 20 completed/unverified calls and all pending ones.

Implementation: `src/predictor.ts`, `src/profile.tsx`, `src/Predict.tsx`, and `getRoundClock` in `src/domain.ts`.

| Prediction accuracy | Base local points |
| --- | ---: |
| Within `max(2 turns, 1% of actual)` | 500 |
| Otherwise, ≤5% error | 250 |
| Otherwise, ≤10% error | 150 |
| Otherwise, ≤20% error | 75 |
| Any other verified guess | 10 |

Percent error is `abs(guess−actual)/actual × 100`. Actual zero with guess zero is 0% error; actual zero with any other guess is 100% error, while the two-turn exact band still takes precedence. Exact-band/≤10% results extend the accuracy streak and add `25 × min(new streak, 5)` bonus points. Other verified guesses reset the streak. Missing evidence leaves it unchanged. If multiple calls become verifiable together, process in round order; a later-recovered call updates the streak when verified. Historical points are not rewritten.

## API data, freshness, and offline behavior

All five requests are made directly from the browser. No proxy or credentials are shipped. The real endpoints were fetched before implementation on October 31, 2026; parsers and fixtures follow those actual responses.

| Public endpoint | Fields powering the game |
| --- | --- |
| [`/v1/status`](https://api.squeekchain.com/v1/status) | `installationId`, `generatedAt`; `measurement.freshness`, `observedAt`, `staleAfterSeconds`, `speedMmPerSecond`, `rpmMilli`, `cumulativeWorkUnits`. A fresh positive speed enables Live Race; idle/fresh zero shows the resting banner and sleeping art. |
| [`/v1/measurement/stats?range=7d`](https://api.squeekchain.com/v1/measurement/stats?range=7d) | `generatedAt`, `installationId`, `window.roundSeconds`, `rounds.medianActiveWork`, `mostActiveWork`, and `activity.coverage.coverageBps`. Supplies typical ghost pace, prediction hint, slider range, and coverage disclosure. |
| [`/v1/measurement/stats?range=30d`](https://api.squeekchain.com/v1/measurement/stats?range=30d) | `rounds.mostActiveWork`, `records.peakObservedSpeedMmPerSecond.{value,occurredAt,coverage}`, `records.mostWorkUtcDay.{value,occurredAt,coverage}`, and the same provenance/window fields. Supplies harder ghosts and the best recorded day. |
| [`/v1/settlements?range=24h`](https://api.squeekchain.com/v1/settlements?range=24h) | `mining.nextRound` schedule; `recentSettlements` evidence above; `summary.completedBlockCount`/`workAdded` for trackside notes. |
| [`/v1/events?limit=20`](https://api.squeekchain.com/v1/events?limit=20) | Safe settlement event `payload` fields above, `occurredAt`, `type`, and `source.confirmationStatus`. Supplies the latest verified milestone and round evidence. |

Status polls every **5 seconds while a race/countdown/pause is active**, otherwise every **15 seconds**, measured after completion of the previous request. Consecutive failures double the interval, capped at 120 seconds. Requests time out at 9 seconds. Events/settlements refresh every minute; stats every fifth auxiliary refresh (normally five minutes). Whole auxiliary failures also back off, capped at five minutes. Retry restarts the reads. A stale measurement is not live just because HTTP succeeded. Incomplete/malformed data fails closed.

`src/data/hamster-snapshot.json` contains a small, faithful subset of real 7-day and 30-day responses obtained on October 31, with their source timestamps. The 7-day response was generated at `2026-10-31T20:28:13.841Z`; the 30-day one at `2026-10-31T20:27:51.149Z`. It includes the actual median 511 turns, record round 699 turns, and peak 1628 mm/s. If measurement requests fail or have no usable pace, the bundled snapshot makes Ghost Race available with a **Cached recording** label. Later successful browser reads replace it. Offline live telemetry shows dashes, and predictions cannot be submitted without a fresh schedule. The gateway must still deliver the site’s assets for a first visit; no service worker is installed.

## Local profile and accessibility

The one storage key is `race-squeektoshi.profile.v1`. All reads, property access, parsing, and writes are wrapped in `try/catch`; corrupt data is normalized or discarded. Blocked/quota-limited storage leaves the game playable with session-only progress and a clear notice. The profile contains a nickname, selected unlocked title, game points, race totals/bests, twelve badges, prediction streak/history, and reward IDs for duplicate protection. There is no shared leaderboard or synchronization. Local game records are user progress, not hamster statistics.

The twelve unlocks cover a first finish/win, five/ten races, 1,000 game meters, twenty perfect taps in sequence, a full-round finish, all three ghosts, a live finish, a first prediction, prediction accuracy, and a three-result accuracy streak. Each unlock has a selectable title. “Share result” copies text and the current site URL for posting on X; blocked clipboard access reveals selectable text instead.

Controls use native buttons, links, fields and a labeled range slider. Routes move focus to the main region; finishes focus their heading. Race announcements summarize time, distances and stamina at five-second intervals instead of speaking every animation frame. History tables have named, keyboard-focusable scroll regions. Reduced motion freezes decorative canvas motion and hides the moving beat marker; gameplay and textual feedback remain available. Sound is off by default and enabled only by its explicit toggle.

## Validation and delivery

Actual checks and coverage, including limitations, are in [`artifacts/validation.md`](artifacts/validation.md). [`DESIGN.md`](DESIGN.md) records the final implemented design system. The pinned Better Interface guide was applied across all six domains; the pinned taste probe passed **16/16** after copy and layout fixes. Strict typecheck, production build, thirteen rule tests, real-API rendering, and Chromium interaction checks passed. WebKit replay and touch checks passed as well. The validation report records the exact scope, fixture use, and manual checks not performed.

The source, lockfile, required runtime assets and `dist/` are delivered together. The `.gitignore` file has a 512-byte budget (its actual size is 318 bytes). Its exclusion path budget is explicit: nested `node_modules`, npm/Vite/general package caches, pnpm stores, TypeScript incremental caches, and disposable `test/scratch/` only. `dist/`, source, licenses and documentation are deliberately included. No dependency archives, submodule, registry mirror, or dependency directory is delivered. The final byte inventory is recorded with the checks.

Fan-made game for Squeekchain. Sepolia testnet; SQK has no monetary value.
