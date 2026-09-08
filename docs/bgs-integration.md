# BGS integration

## Contract already implemented

Engine entry point: `dist/wrapper.js` from `fuji-engine`. The wrapper exports init, move, ended, scores, rankings, currentPlayer, dropPlayer, logLength, logSlice, stripSecret, round, replay and setPlayerMetaData, plus the optional isLiveUpdate hook. `hashSeed = true`; the seed never appears in a stripped view. `moveAI(state, player)` returns a new state using the shared baseline bot; the harness and simulations use the same implementation.

Viewer: self-contained IIFE, global `fuji`, function `launch(selector)` returning an emitter. The bridge consumes state/player events, requests fresh state on state updates and game logs, forwards moves without double wrapping, and announces readiness after rendering the initial state. The host continues to provide chat, clocks, identity and iframe messaging. Source assets are bundled as data URLs, so the initial viewer has no independent asset-hosting requirement.

```sh
pnpm check
cd packages/engine
pnpm pack
```

Upload the engine tarball and viewer JS/CSS together. The draft registration file intentionally contains empty URLs until real uploads exist. Do not run a publication operation without the user's supplied admin token. Keep `public: false` and `replayable: false` for the first private test.

## Live updates and remaining timed-beta work

The platform's [isLiveUpdate contract](https://docs.boardgamers.space/guide/engine-api#isliveupdate) is supported. BGS calls this hook on the saved state (the return value of `toSave`, or the move result when `toSave` is absent). Fuji returns true for route edits and readiness changes that leave the planning phase open. These updates preserve active seats, persist and broadcast without any turn side effects.

Planning is one collective validation: only the final confirmation that starts rerolling is a normal turn save. Its actor receives the planning increment; other players do not receive a separate planning increment. Repeated ready → route edit → ready cycles earn nothing while the phase stays open. Definitive equipment actions, rerolls and other gameplay actions retain normal turn handling. This is an explicit alpha clock policy, not an equal per-player planning allowance; review it during multiplayer testing.

The engine overwrites a single `planningSnapshot` containing only paths, readiness and revision. Provisional edits append neither replay-history entries nor public log lines. A definitive action checkpoints the latest snapshot once into replay history, then records the action. Final routes enter the public log when planning closes. The history therefore grows with definitive actions, not pointer clicks or repeated confirmations. Replaying the head also restores the pending snapshot, including after JSON serialization. The snapshot and the `liveUpdate` protocol marker are excluded from viewer projections; public paths and readiness remain visible normally.

No further platform protocol extension is needed for these updates. Existing development saves from before this history change are not a supported replay migration; start a new local game when testing this alpha.

During planning and equipment phases `currentPlayer` includes all players, including those marked ready, so the BGS turn gate permits revisions and reactions before the phase closes. This also means their clocks keep running until the phase changes; the UX and clock policy need explicit integration testing.

Fuji has a shared win/loss. The wrapper gives all players the same ranking and reports their individual contributions, but BGS's result display and Elo handling need to be checked for a cooperative title. A group loss must not appear as a competitive draw or grant inappropriate Elo.

## Validation still requiring a running BGS test

- Register a non-public version and grant access to test accounts.
- Connect 2–4 separate sessions and a spectator; check private dice and public readiness.
- Reload and reconnect during an equipment request, reroll and injury selection.
- Check clock increments and ready-state behavior using the policy described above.
- Verify team win/loss presentation, no competitive rating side effects, and player-drop behavior.
- Check the actual iframe bundle and style uploads, not only the Vite dev harness.

## Viewer preferences

`colorblind` is a boolean UI preference, false by default. The viewer reads the platform `preferences` event and emits `update:preference` with `{ name: "colorblind", value: boolean }` when changed in Help. It adds color names to dice and color initials to map requirement symbols without changing game state. The local harness persists the same setting in localStorage. The draft registration declares the checkbox for the platform sidebar.

## Automatic movement resolution

Starting a movement resolves it immediately when no Gatherer has usable bars. Otherwise only the Gatherer(s) are active: each submits one `help` action with `count` from zero to their remaining stock. The last decision applies movement, eruption triggers and stamina automatically. Injury choices still belong to the injured player. The journal snapshots revealed and matching dice with text fallbacks for the platform log. Start a new local game when testing this flow; historical development saves using manual resolution are not migrated.
