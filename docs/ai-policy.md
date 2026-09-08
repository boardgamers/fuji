# Playtest AI

The platform export and local harness use the same deterministic `moveAI`. Every decision receives `stripSecret(state, seat)`. Neither the seed nor hidden teammate faces are available. Wireless reveals therefore affect both route selection and equipment decisions; masked faces remain an estimate.

## Scoring

Routes balance distance to the village, imminent lava, eruption markers, pickups and expected matching contribution after available rerolls. The bot avoids reserving a neighbor's only remaining destination when it can choose another. Rerolls compare each face with its destination-specific expected replacement, including weak matching faces.

Equipment scoring convolves the published die faces into distributions for opposing matching totals. Visible faces are fixed; hidden faces use independent fair-roll priors. It estimates strict comparison success and stamina loss, rather than using one universal “good total.” These estimates do not model teammates' subsequent reroll strategy.

Deterministic face changes may not reduce the bot's own contribution or increase its contribution against any comparison neighbor's destination. Conflict reductions carry three times the weight when that neighbor's current location is threatened by the next eruption. Four-player opposite seats are not comparison neighbors.

## Equipment and abilities

| Card or ability       | Heuristic                                                                                                                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flare gun             | Spend for improved estimated movement success or stamina loss; conserve if already unbeatable without loss.                                                                               |
| Shovel, Tape, Compass | Compare legal face changes and subsets using the destination criteria and teammate conflicts.                                                                                             |
| Machete               | Remove one or two conflicting dice without reducing the bot's own total.                                                                                                                  |
| First aid kit         | Compare expected stamina saved with other equipment; do not reuse an active effect.                                                                                                       |
| Torch, Water flask    | Reroll weak dice, accounting for expected extra conflict. Water can help a teammate whose revealed dice show a benefit. Optional responses decline if no useful reroll remains.           |
| Map, Fire lighter     | Lend or request a publicly identifiable useful die that does not contribute to the donor's destination or worsen a third player's comparison. The donor independently validates the loan. |
| Wireless              | Reveal a weak roll or substantial conflict while teammates still have decisions. Revealed faces inform their route and equipment scoring.                                                 |
| Carabiner             | Require revealed evidence that every player has a non-negative expected reroll choice. Mandatory responses choose the best available die.                                                 |
| Rope                  | Advance toward the village or escape an imminent eruption, avoiding threatened destinations, eruption triggers and reserved endpoints.                                                    |
| Binoculars            | Improve a nearby reachable empty location by swapping in more favorable criteria. Do not disturb chosen locations.                                                                        |
| Pocketknife           | Evaluate eligible copies through the same heuristics; prefer a dedicated card for equivalent deterministic benefits.                                                                      |
| Buddy                 | Set aside a die that contributes nothing locally but conflicts with a neighbor, prioritizing the threatened neighbor.                                                                     |
| Gatherer              | Keep rerolls for improving weak rolls; collect unused rerolls as bars. Spend the minimum bars that turns a failed comparison into success.                                                |
| Equipment manager     | Pass cards blocked by an arm injury to an uninjured teammate, prioritizing imminent danger.                                                                                               |
| Scout, Survivalist    | Route scoring includes their movement limits and reroll allowances.                                                                                                                       |
| Tinkerer              | Reevaluate the retained card after its first use, respecting the engine's two-use limit.                                                                                                  |

These are deliberately bounded heuristics. Setup card selection and injury choice remain simple; equipment gifting is conservative. Carabiner and Fire lighter can be rare without Wireless reveals. Bots do not negotiate privately or infer another player's secret dice from their actions.

## Reproducing the experiment

Run `pnpm --filter fuji-engine build`, then `node scripts/benchmark-ai.mjs`. The report is `docs/ai-benchmark.json`.

Six policies each run 180 training games, with the same seeds across policies, 2–4 players and difficulty 1–4. The strongest candidate without stalled games is compared with the no-equipment baseline on 300 separate held-out games each. Replay equality is checked every tenth seed. Stalled games count as non-wins and disqualify a candidate; they are recorded rather than silently discarded.

The benchmark uses scenario 1 and the default skill assignments. It measures complete-team wins, not individual matching totals. Results do not establish optimal play or performance on unimplemented scenarios.

### September 8 experiment

1,680 games were attempted: 1,080 training and 600 held-out comparisons.

| Policy                      | Training wins / 180 |
| --------------------------- | ------------------: |
| No equipment baseline       |                  51 |
| Balanced equipment          |                  70 |
| Stamina emphasis            |                  70 |
| Escape emphasis             |                  71 |
| Higher expected-lead weight |                  58 |
| Faster village progress     |                  66 |

The escape-emphasis policy was selected before held-out evaluation. It won **112/300 (37.3%)**, compared with **87/300 (29.0%)** for the baseline: an 8.3 percentage-point improvement on this seed set. Neither stalled in held-out evaluation. The small training differences between equipment variants are not evidence of a universally optimal parameter set.

The higher-lead candidate stalled once: two neighbors ended up sharing an isolated village card with no remaining legal distinct destinations. That candidate was rejected. This late-game engine/rules edge case remains recorded in the report; the AI cannot invent a legal move in that state. All other benchmark games terminated. Tests also exercise each equipment card in constructed useful situations, since conservative lending and Carabiner use are rare in full games without multiple Wireless reveals.

## Village space

Bots already in the village prefer to leave scarce, reachable entrances for approaching comparison neighbors. The preference uses public routes, weights teammates near lava more heavily, and favors leaving shorter approaches available. It applies only to village destinations safe from the next eruption and routes without eruption markers; ordinary dice and route scoring still apply. Neighbors already in the village or with finalized routes do not add pressure to move.

Matched comparison for the village-space change: 240 identical seeded games using the same engine, with only the previous AI module substituted for the baseline. Scenario 1 used 50 seeds at each of 2/3/4 players; scenarios 2–7 used five seeds at each player count. Difficulty cycled through 1–4. Baseline: 70 wins (63 + 7), 13,911 moves. Updated: 72 wins (64 + 8), 13,631 moves. Both completed all games without deadlocks and with exact replays. The gain from 29.2% to 30.0% is small and does not establish statistical significance.

## Connected-path distance and equipment retuning

Scenario 7 exposed a geometric error: coordinate distance penalized walking around the gap between the starting trail and village, encouraging repeated stays. Planning and Rope now use shortest connected paths through walkable locations, excluding lava. This uses public board information only.

The matched experiment in `ai-detour-benchmark.json` covers all seven scenarios, 2–4 players, difficulty 1–4 and default skills. Seven candidates each played 168 training games (1,176 runs). Four candidates then played 252 separate held-out games each (1,008 runs). Every run terminated and replayed exactly.

| Policy                               | Training wins / 168 | Held-out wins / 252 |
| ------------------------------------ | ------------------: | ------------------: |
| Previous coordinate distance         |                  15 |                  29 |
| Connected route distance             |                  46 |                  61 |
| Connected route and Rope distance    |                  48 |                  61 |
| More conservative equipment spending |                  44 |          Not tested |
| More generous equipment spending     |                  46 |          Not tested |
| More stamina emphasis                |                  44 |          Not tested |
| More teammate emphasis               |                  48 |                  61 |

The selected policy retains the original weights and corrects distance for both routes and Rope. Held-out wins increased from 11.5% to 24.2% versus the previous AI. Scenario 7 increased from 2/36 to 7/36; that per-scenario sample is small. Rope's correction tied route-only results overall and lost two scenario-7 wins in held-out seeds, so its geometric correctness should not be confused with a demonstrated additional win-rate improvement. Equipment weight changes did not establish a stronger policy.

Reproduce a current-policy batch with `node scripts/benchmark-policy.mjs current heldout 12`. Use `teamwork`, `frugal`, `generous`, or `stamina` to test the recorded alternatives. `FUJI_BENCH_ENGINE` can select an alternate compiled engine directory for matched historical comparisons. Reports are written to `work/benchmarks`. Seed families are independent of policy names.

## Planning equipment order

Before using planning rerolls, the bot evaluates its desired route and any useful prospective Binoculars swap. A swap is considered useful only when the normal route planner would choose its improved destination. Torch and Water flask are evaluated against that intended destination, including its hypothetical post-swap requirements. The bot rolls first and reevaluates the route and swap afterward; it does not spend Binoculars merely to improve an unused nearby tile. A prospective swap does not place a destination marker, which would make that tile ineligible for swapping.

Regression coverage verifies reroll selection against the proposed destination without mutating the board or consulting hidden teammate dice. A further 168 games spanning all scenarios, player counts and difficulties completed with exact replays and no deadlocks. This validation batch is not a matched win-rate comparison.

## Helping from a safe village

A bot staying on its current village tile can prioritise reducing its dice contributions against escaping comparison neighbours. It applies only outside the next eruption wave, with stamina strictly above the maximum possible loss for this round. Rerolls seek lower opposing contributions instead of improving the resident's own result. Buddy and Machete may set aside dice that also match the resident's own location. Residents at risk of exhaustion or threatened by lava retain the ordinary survival policy. Hidden teammate dice remain unavailable.

A matched 252-game comparison across seven scenarios, 2–4 players and difficulties 1–4 increased complete-team wins from 65 (25.8%) to 69 (27.4%). Every game terminated and replayed exactly. This four-win difference is modest; it does not establish a universally stronger policy. Results are in `ai-village-help-benchmark.json`, using seed family `village-help`, 12 seeds per scenario/player-count combination. The baseline is the AI from commit b769c7e.
