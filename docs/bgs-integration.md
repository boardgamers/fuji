# BGS integration

## Contract already implemented

Engine entry point: `dist/wrapper.js` from `fuji-engine`. The wrapper exports init, move, ended, scores, rankings, currentPlayer, dropPlayer, logLength, logSlice, stripSecret, round, replay and setPlayerMetaData. `hashSeed = true`; the seed never appears in a stripped view. No `moveAI` export is provided yet.

Viewer: self-contained IIFE, global `fuji`, function `launch(selector)` returning an emitter. The bridge consumes state/player events, requests fresh state on state updates and game logs, forwards moves without double wrapping, and announces readiness after rendering the initial state. The host continues to provide chat, clocks, identity and iframe messaging. Source assets are bundled as data URLs, so the initial viewer has no independent asset-hosting requirement.

```sh
pnpm check
cd packages/engine
pnpm pack
```

Upload the engine tarball and viewer JS/CSS together. The draft registration file intentionally contains empty URLs until real uploads exist. Do not run a publication operation without the user's supplied admin token. Keep `public: false` and `replayable: false` for the first private test.

## Platform work required before a normal timed beta

BGS credits the per-move clock increment for each persisted engine action. Fuji has public, revisable planning and multi-person equipment effects. Persisting those events is necessary so another player's response cannot overwrite or lose them, but an increment on every planning edit would allow time farming. `toSave: undefined` is not a safe substitute here: it would discard the shared intermediate state.

The platform needs a supported way for the engine to indicate which persisted actions earn a time increment, or a carefully designed equivalent. A private test with zero per-move increment avoids that particular issue, but this is not yet verified on a running BGS instance. Do not claim full timed integration from the standalone playtest alone.

During planning and equipment phases `currentPlayer` includes all players, including those marked ready, so the BGS turn gate permits revisions and reactions before the phase closes. This also means their clocks keep running until the phase changes; the UX and clock policy need explicit integration testing.

Fuji has a shared win/loss. The wrapper gives all players the same ranking and reports their individual contributions, but BGS's result display and Elo handling need to be checked for a cooperative title. A group loss must not appear as a competitive draw or grant inappropriate Elo.

## Validation still requiring a running BGS test

- Register a non-public version and grant access to test accounts.
- Connect 2–4 separate sessions and a spectator; check private dice and public readiness.
- Reload and reconnect during an equipment request, reroll and injury selection.
- Check clock increments and ready-state behavior using the policy described above.
- Verify team win/loss presentation, no competitive rating side effects, and player-drop behavior.
- Check the actual iframe bundle and style uploads, not only the Vite dev harness.
