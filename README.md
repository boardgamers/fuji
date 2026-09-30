# Fuji

A playable first implementation of Wolfgang Warsch’s cooperative game for Boardgamers, with artwork by Weberson Santiago supplied by Feuerland.

This is a **private playtest alpha**, not a publisher-approved final adaptation. It implements all seven scenarios, two to four players (two-player variant A), all four difficulty levels, six skills and fifteen equipment effects. The visual direction uses the original illustrations as an interactive landscape, with private dice totals, route previews, revealed comparisons and state-driven lava.

Canonical source: [codeberg.org/boardgamers/fuji](https://codeberg.org/boardgamers/fuji).

## Play online at

[boardgamers.space](https://boardgamers.space/boardgame/fuji)

## Run

Requires Node 24+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5187`. The local harness keeps a playtest in browser storage. Click an adventurer to switch seats. **Play next teammate action** advances a simple, non-omniscient test player one action; it uses the same cooperative equipment and route heuristics as the platform AI. **New game** replaces the local save.

```sh
pnpm check
pnpm simulate
pnpm fmt
```

The engine tests cover deterministic replay, invalid-move atomicity, private information, movement, lava, injury timing and equipment interactions. Simulation runs 150 complete expeditions across player counts and difficulty levels and verifies exact replays. Browser smoke testing covers setup, route selection, every round phase, game end, mobile overflow and the help dialog.

## Tutorial

Open `http://127.0.0.1:5187/tutorial.html?chapter=first-steps` to play a lesson. Each chapter uses the real engine, a prepared position and scripted teammates. Progress resumes separately for each chapter; playback controls let you go back, replay a step or start over.

`pnpm build` produces one viewer JS/CSS bundle for games and tutorials. Upload it as the viewer with global name `fuji`, then add these chapters under **Tutorial** in BGS admin (revision `2` for chapters 1–3, `5` for chapter 4, `1` for chapter 5):

| ID                | Title                              | Covers                                                                          |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `first-steps`     | Your first journey                 | Destinations, matching dice, rerolls, Buddy and movement.                       |
| `equipment`       | Equipment & helping teammates      | Shovel, Map, card timing, discards and private loans.                           |
| `terrain-bonuses` | Location bonuses & supplies        | Bonus rerolls, equipment tokens and next-round availability.                    |
| `lava`            | When two lava waves catch the team | A deliberate defeat: an extra eruption plus the normal wave catches a teammate. |
| `village`         | Everyone reaches the village       | A team victory, with all three explorers completing their final journeys.       |

Chapter sources: `packages/viewer/src/tutorial/first-steps.ts` and `lessons.ts`. Keep setup and teammate actions deterministic; bump the chapter revision for incompatible changes. `pnpm check` tests legal actions, lesson outcomes, hidden information and saved progress. `node tests/tutorial-browser.mjs` completes every chapter on desktop and mobile. BGS calls `fuji.launchTutorial` for local lessons and `fuji.launch` for multiplayer games.

## Packages

- `packages/engine`: pure TypeScript rules, serializable state, seeded randomness, immutable move application and `dist/wrapper.js` for BGS.
- `packages/viewer`: Svelte 5 viewer. Builds a self-contained `dist/fuji-viewer.iife.js` exposing `window.fuji.launch(selector)` and a stylesheet. The BGS host owns chat, clocks and the iframe message protocol.
- `scripts/extract-assets.py`: reproducible extraction from the supplied production PDFs. Original archives are not included in this repository.
- `docs/rules-status.md`: implementation scope, evidence and unresolved rule details.
- `docs/bgs-integration.md`: packaging, protocol and remaining platform integration work.

## Artwork

The supplied artwork is embedded in optimized WebP assets. Its copyright remains with the respective rights holders; the source-code license does not license the illustrations. The PDFs contain illustrations separate from symbols, but do not supply editable scene layers. Further art direction and animation work can build on this first playable version.

Code, identifiers, documentation and current UI copy are in English.

## Browser checks

With `pnpm dev` already running and a current `pnpm build`:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

If Chromium is already installed in a non-default location, set `FUJI_CHROMIUM_EXECUTABLE` to its executable path. Screenshots are written under the ignored `work/browser` directory. The second smoke test loads the actual production bundle with a minimal BGS emitter host, checks readiness and state refresh, verifies the move payload, and confirms that Wireless exposes the correct dice without loading the local harness.

Private release: build with `pnpm check`, pack the engine with `pnpm --filter fuji-engine pack --pack-destination ../..`, then run `BGS_TOKEN_FILE=/path/to/token node scripts/publish-private.mjs`. The script registers private version 1, uploads bundles and rules, and grants Spock and AlphaZero access. It refuses to overwrite an existing game without review.

Run `FUJI_ALL_SCENARIOS=1 pnpm simulate` for 1,050 seeded expeditions across all seven maps.

Viewer releases: see [uploading the complete viewer build](docs/viewer-publishing.md).
