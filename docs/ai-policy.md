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
