# Rules status

## Evidence

The publisher-supplied English production rulebook is `EN_Fuji_Regel_PRINT_3_130918.pdf` (13 September 2018). Terrain faces are transcribed from `fuji_land_front_Print3.pdf`; setup from scenario card 1; skills and equipment from the English fronts and rulebook appendix. The stamina track has exhaustion at step 25, with injury thresholds at steps 5, 10, 15 and 20.

The terrain names used in the UI are descriptive navigation labels, not printed card titles. Terrain IDs are the one-based production PDF page numbers.

Dice were inferred from 17 user-supplied groups (88 dice, 148 visible faces). Under the three-types/two-of-each model, exactly one value/color composition fits every observation:

| Value | A      | B      | C      |
| ----- | ------ | ------ | ------ |
| 1     | Blue   | Yellow | Pink   |
| 2     | Yellow | Pink   | Blue   |
| 3     | Pink   | Blue   | Yellow |
| 4     | Pink   | Blue   | Yellow |
| 5     | Yellow | Pink   | Blue   |
| 6     | Blue   | Yellow | Pink   |

Each full set contains two of each type. This remains observation-derived rather than publisher-certified. Faces 1 and 6 have different values but the same color in all three types, so Tape and Compass do not introduce a color change.

## Implemented first slice

- Scenario 1, including the additional village and split starting positions at four players.
- All 24 landscape and 6 village card criteria, including AND/OR conditions and reroll symbols; scenario setup shuffles the appropriate decks.
- Two-player variant A: six neutral dice, three visible during planning and three hidden until reveal. No neutral pawn.
- Four difficulty levels; strict comparisons against seated neighbors; ties fail; stamina and immediate team defeat/victory.
- Equipment preparation choices and one-die removal for five-die skills.
- Six skills, fifteen equipment effects, donor consent for the lighter, per-player mandatory Carabiner rerolls, staged Water rerolls and Tinkerer reuse.
- Set-aside dice visible to everyone and excluded from comparisons; temporary loans return after the round; leg-injury removal occurs after all comparisons.
- Phase-five movement order is chosen by the players. Power bars are offered by their owner, rather than automatically spent by the recipient.
- Additional eruptions are applied when traversing eruption markers; ordinary eruptions propagate one wave, never recursively through the entire map.
- Win triggers as soon as everyone reaches the village, before further stamina deductions or eruptions.

## Deliberate alpha boundaries and interpretations

1. Only scenario 1 is enabled. Scenarios 2–7, the advanced two-player variant B and the extra-thrill double-eruption variant are not yet implemented.
2. For a five-die skill, the player chooses which die to leave behind before any dice are rolled. The supplied material has not established the official selection procedure. This is an explicit provisional rule.
3. The two-player simple variant splits one of each inferred type into the visible and hidden halves. The text specifies three visible and three hidden dice but does not mandate this split.
4. A planned path is explicit. If an earlier extra eruption blocks that path, resolution treats it as a failed move unless an alternative legal path to the same locked destination is supplied. Check this interpretation against the publisher before beta release.
5. Pocketknife follows the printed English equipment card: copy equipment belonging to another player. The appendix wording is broader; confirm whether copying one's own equipment should also be allowed.
6. The local skill assignment is fixed for the first slice (Buddy, Gatherer, Equipment manager, then Survivalist); the engine accepts a `skills` array, but a complete pregame skill/character selection UI is still needed.
7. Dropping a player ends the cooperative expedition. No replacement bot is enabled in the BGS wrapper.
8. Live state and the journal work. Full server replay exists, but viewer replay controls are not implemented, so the BGS viewer must be registered with `replayable: false`.
9. Original PDF art is usable and extracted, but the environment is still a first visual pass. It is not yet the final animation/presentation quality intended for Feuerland.

## Next acceptance checks

Play full expeditions with people familiar with the physical game. Verify the provisional interpretations, five-die selection and every equipment/skill combination against the physical reference. Extend scenario data from the already-supplied seven cards. Validate BGS multiplayer, clocks, reconnection and cooperative outcomes before publication.

### Automatic movement order

New expeditions default to `autoMovement: true` in their saved initialization options. Existing saves retain their previous manual order. `autoMovement: false` remains available for manual play and isolated resolution tests.

After the equipment reveal, the engine evaluates all remaining movement permutations (at most 24), using cloned states and the existing resolution rules. It prioritizes winning, then avoiding immediate defeat, reaching village locations, completing moves, conserving stamina, and reducing exposure to the next eruption. Equal scores prefer routes with fewer eruption triggers, then seat order. The search does not consume RNG or append speculative logs or synthetic moves to the saved game.

This is an automated choice of the freely chosen tabletop order, not a guarantee of an optimal strategy. Previews assume no further Gatherer spending and do not guess injury choices. Actual play pauses for those decisions and recalculates afterward; revealed dice, comparisons and movement outcomes remain in the journal. It does not use deck contents to choose an order. Resolution proceeds within the action that reveals dice or completes the pending decision, without a new platform protocol or clock pause.

### Skipping forced actions

New games enable `autoProgress`. Empty or out-of-phase equipment hands pass automatically, unless the Equipment Manager can transfer a card. Equipment transfers reset readiness, so new choices reopen. Forced non-leg injuries and eruption resolve automatically. Reroll completion automatically skips players with no rerolls and no unused Buddy choice. Gatherer decisions are skipped when the whole remaining stock cannot change success or stamina loss; a successful move may still merit bars to reduce stamina loss. Equipment readiness removes players from the active list until another equipment action reopens decisions.

Automatic equipment passes use only public eligibility (cards, phase, injuries), never private face values. Tape and Compass therefore still require a decision even when the owner privately knows there are no eligible dice. Planning, optional equipment use, lending consent, meaningful bars and injury/die choices remain manual. Existing saves without `autoProgress` retain the earlier progression behavior except for reroll completion.

### Baseline AI

`moveAI(state, player)` is exported from both the engine and BGS wrapper and returns a new state through `applyMove`. The local harness and full-game simulations call the same implementation. Decisions use `stripSecret` for that player, with no access to hidden teammate dice or the random seed. The route heuristic prioritizes destinations outside the next eruption, then balances expected comparison lead after the available rerolls, village distance, distance from lava, pickups and eruption markers. Expectations use the published die faces and only publicly visible teammate faces. Rerolls include low matching faces when rolling again improves expected contribution; unused rerolls yield Gatherer bars. This is a heuristic, not a guarantee of movement or a full model of teammates’ future rerolls. It spends the minimum bars that turn a failed comparison into success. It does not optimize equipment use or Gatherer bar farming.

The wrapper's `currentPlayer` excludes players with confirmed planning intentions, so the platform bot driver does not repeatedly play an already-ready bot. Provisional confirmations remain live updates; the platform's stored clock behavior is unchanged.

## Viewer event pacing

Public movement paths and eruption cell lists in journal events allow the viewer to sequence automatic resolution without extra engine moves or saved intermediate states. The map and journal play events in order, with a skip control; the authoritative received state and platform clocks are unchanged. Initial loads and seat changes show the current state immediately. Reduced motion skips intermediate path positions. The local bot driver waits for playback and uses a 2.2-second action cadence. Confirmed-route journal records preserve the original terrain, equipment and eruption markers and reroll allowance. Equipment is public (rulebook page 8, face-up cards) and appears as pictograms with hover previews on player panels.

Sound effects combine a CC0 recording of real dice throws (see `audio-credits.md`) with synthesized Web Audio foley synchronized with presented events (steps, lava, dice, equipment), governed by the platform's reserved `preferences.sound` boolean (absent means enabled, per platform PR #503). No game-specific preference overrides the platform mute. The harness offers a local sound toggle, individual cue previews, and a random-seed restart. Copy equipment, shovel values, preparation dice and local game configuration expose their choices directly without select controls.
