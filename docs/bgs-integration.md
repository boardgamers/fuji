# BGS integration

## Contract already implemented

Engine entry point: `dist/wrapper.js` from `fuji-engine`. The wrapper exports init, move, ended, scores, rankings, currentPlayer, dropPlayer, logLength, logSlice, stripSecret, round, replay and setPlayerMetaData, plus the optional isLiveUpdate hook. `hashSeed = true`; the seed never appears in a stripped view. `moveAI(state, player)` returns a new state using the shared baseline bot; the harness and simulations use the same implementation.

Viewer: self-contained IIFE, global `fuji`, function `launch(selector)` returning an emitter. `@boardgamers/protocol` handles viewer registration, validated events, state refreshes, readiness and cleanup. Its `ChatController` handles chat history, unread messages and send acknowledgements; the Svelte UI subscribes to its snapshots. The host provides chat transport and storage, clocks, identity and iframe messaging. Set `viewer.chat: true`: Fuji renders chat during and after the expedition, including lobby history. The bridge handles `chat:messages`, `chat:appended`, `chat:updated`, `chat:deleted`, `chat:state`, `chat:disabled` and `chat:result`; sends carry a request ID and visible messages emit `chat:read`. Chat drafts and updates are independent of game animation playback. The `chat:state` roster supplies mention suggestions. Messages use BGS-provided text, link and mention segments, with plain text as a fallback; outgoing mentions use `@name` or `@"Full Name"`. Links follow platform trust rules, and reading the chat clears the platform mention badge. The local harness keeps its chat separately in local storage; switch seats to test multiple authors. Source assets are bundled as data URLs, so the initial viewer has no independent asset-hosting requirement.

```sh
pnpm check
cd packages/engine
pnpm pack
```

Upload the engine tarball and viewer JS/CSS together. The draft registration file intentionally contains empty URLs until real uploads exist. Do not run a publication operation without the user's supplied admin token. Keep `public: false` and `replayable: false` for the first private test.

## Live updates and remaining timed-beta work

Fuji uses the BGS `isLiveUpdate: true`, `timeIncrements` and `canMoveOutOfTurn` hooks. Deploy platform support before publishing this engine. Route edits and readiness changes in an open planning, reroll or equipment phase synchronize active seats. Confirmed players become inactive immediately; reopening resumes their remaining clock. Unchanged active players retain their existing clocks.

Players can reopen only their own choices while the phase is open, with no pending equipment response or injury. Revealed dice, spent equipment and resolved movement cannot be undone. Gatherer bars are awarded once when the whole team finishes rerolling, so reopening preserves unused rerolls without duplicating rewards.

Readiness edits overwrite the bounded `planningSnapshot` (paths, readiness, completed decisions and revision), including during reroll and equipment. They append neither history entries nor public log lines. Actual gameplay actions and phase transitions checkpoint it once for deterministic replay. The snapshot and `liveUpdate` marker are excluded from viewer projections.

Every player's first confirmation earns an increment, including the last confirmation that advances the phase. Reopening and reconfirming the same choice earns nothing. Equipment effects or gifts that reset readiness create new decisions, so confirming again earns another increment. Actual equipment uses, rerolls and other definitive actions continue to earn their normal increment. `timeIncrements` replaces the default mover increment; the last confirmer is never credited twice.

Completion counts and confirmation flags are kept in the private `turns` field and replayed with the readiness snapshot. They grow only for completed decisions and are excluded from viewer projections. Equipment reactivations are bounded by the finite card supply and uses; only the manager can give cards away.

Fuji has a shared win/loss. The wrapper gives all players the same ranking and reports their individual contributions, but BGS's result display and Elo handling need to be checked for a cooperative title. A group loss must not appear as a competitive draw or grant inappropriate Elo.

## Validation still requiring a running BGS test

- Register a non-public version and grant access to test accounts.
- Connect 2–4 separate sessions and a spectator; check private dice and public readiness.
- Reload and reconnect during an equipment request, reroll and injury selection.
- Check clock increments and ready-state behavior using the policy described above.
- Verify team win/loss presentation, no competitive rating side effects, and player-drop behavior.
- Check the actual iframe bundle and style uploads, not only the Vite dev harness.

## Viewer preferences

`colorBlind` is the platform’s shared color-blind preference, false by default. It is stored on the BGS account and used across supported games. The viewer reads the platform `preferences` event and emits `update:preference` with `{ name: "colorBlind", value: boolean }` when changed in Help. It adds color names to dice and color initials to map requirement symbols without changing game state. The local harness persists the same setting in localStorage. The draft registration declares the checkbox so the platform shows its shared control. Incoming preference updates must not write back to the host.

## Automatic movement resolution

Starting a movement resolves it immediately when no Gatherer has usable bars. Otherwise only the Gatherer(s) are active: each submits one `help` action with `count` from zero to their remaining stock. The last decision applies movement, eruption triggers and stamina automatically. Injury choices still belong to the injured player. The journal snapshots revealed and matching dice with text fallbacks for the platform log. Start a new local game when testing this flow; historical development saves using manual resolution are not migrated.
