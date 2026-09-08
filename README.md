# Fuji

A playable first implementation of Wolfgang Warsch’s cooperative game for Boardgamers, with artwork by Weberson Santiago supplied by Feuerland.

This is a **local alpha**, not a published or publisher-approved final adaptation. It implements scenario 1, two to four players (two-player variant A), all four difficulty levels, six skills and fifteen equipment effects. The visual direction uses the original illustrations as an interactive landscape, with private dice totals, route previews, revealed comparisons and state-driven lava.

## Run

Requires Node 24+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5187`. The local harness keeps a playtest in browser storage. Click an adventurer to switch seats. **Play next teammate action** advances a simple, non-omniscient test player one action; it is a testing aid, not a strategic AI. **New game** replaces the local save.

```sh
pnpm check
pnpm simulate
pnpm fmt
```

The engine tests cover deterministic replay, invalid-move atomicity, private information, movement, lava, injury timing and equipment interactions. Simulation runs 150 complete expeditions across player counts and difficulty levels and verifies exact replays. Browser smoke testing covers setup, route selection, every round phase, game end, mobile overflow and the help dialog.

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
