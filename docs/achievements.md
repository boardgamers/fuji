# Fuji achievements — revision 1

Engine 0.1.13 adds achievements to the existing BGS version 1 public beta under
explicit engine-only update authorization. Live configuration was verified as
`public: true`, `status: beta`, `viewer.replayable: false`, `tableMode: async`, and
`settings: []`; the update preserves those fields and the existing viewer.
This does not resolve the pre-existing clock, cooperative result/rating, or live
validation concerns in `bgs-integration.md`. The engine and viewer source use the published
`@boardgamers/protocol` 0.11.0 package. The wrapper exports the optional
`achievementDefinitions()` and `achievements(state)` hooks from its engine contract.
The latter accepts the persisted JSON-compatible engine state (not a JSON string).

## Manifest

All feats require a completed cooperative victory and are awarded to every seat:

| Stable ID                                       | Requirement                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `escape-together`                               | Win an expedition.                                                          |
| `scenario-1-escape` through `scenario-7-escape` | Win that numbered scenario, at any difficulty.                              |
| `difficulty-2-escape`                           | Win at difficulty 2 or higher.                                              |
| `difficulty-3-escape`                           | Win at difficulty 3 or higher.                                              |
| `difficulty-4-escape`                           | Win at difficulty 4.                                                        |
| `strength-to-spare`                             | Everyone has at least 11 stamina remaining.                                 |
| `unscathed-team`                                | Everyone has no injuries, including pending injury selections.              |
| `narrow-escape`                                 | Someone has 5 or less stamina remaining.                                    |
| `well-equipped`                                 | Everyone still carries an equipment card (including a partially used card). |
| `four-to-safety`                                | Win with four explorers.                                                    |

Sixteen definitions in total. IDs must not be repurposed; definition changes require
a manifest revision bump. Icons are omitted for the platform's default game-icon
fallback; no transient asset URLs or unregistered asset keys are introduced.

## Semantics and eligibility

Fuji's ranks are all 1, even on defeat. Explicit `won` / `lost` outcomes map to
`win` / `loss` for **every** seat. Losses receive no feats. BGS remains responsible
for account mapping and bot, dropped-player and cancellation eligibility; the
engine does not guess human identity from names. Drop-induced engine defeats
still report loss rather than falsely reporting a win from tied rankings.

Only `phase: ended` with an actual outcome is evaluated. Explicit boolean
`initOptions.tutorial`, `practice`, or `analysis` excludes the session entirely.
Tutorial construction and both analysis constructors now set their respective
flags. Ordinary games, including historical saves without these flags, remain
eligible; old saves without a resolved scenario cannot earn a scenario feat.
A random scenario uses its resolved `state.scenario`, not the setup option.
No seed-prefix heuristics or undocumented history claims are used.

Importantly, the internal `player.stamina` is **exhaustion accumulated**, from 0
to 25, not stamina remaining. These checks use `EXHAUSTION - player.stamina`.
All feats inspect final state only: no claims about never using equipment,
rerolling, communications, or past dice. No private data is returned or logged.

## Verification

Tests validate the manifest and results with the official protocol schemas and
optional-method inspector. Deterministic legal moveAI expeditions (used as a
fixture driver, not evidence of account eligibility) reach every one of the 16
feats, with exact engine replays and JSON round trips. Additional tests cover a
natural defeat, drop defeat, all-seat equality, difficulty stacking, scenario
exclusivity, excluded/incomplete sessions, purity, independent result arrays,
and explicitly synthetic threshold probes. Browser behavior is not asserted.
