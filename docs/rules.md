# Fuji: how to play

Fuji is a cooperative escape game for 2–4 players. Everyone must reach a village location before the lava or exhaustion catches anyone. The house symbols mark village locations. The counter beside the map shows how many players have arrived.

This private alpha implements all seven scenarios and the simple two-player variant with neutral dice. Choose a scenario to change the map layout, starting positions, equipment tokens and eruption markers. Each seed shuffles terrain cards within that layout. Scenario numbers are not difficulty levels.

Terrain names in the viewer are navigation labels added for this adaptation.

## Your expedition

Each player has private dice, a character skill, equipment and 25 stamina. Some skills start with five dice instead of six. During preparation, make any equipment and die choices the viewer offers. Players with no preparation choice proceed automatically.

The player cards show remaining stamina (♥), injuries, public equipment and the Gatherer's power bars. Hover over an injury or equipment pictogram for its effect. Gold player-card borders indicate players who can act.

## Each round

### 1. Plan together

Your dice are rolled behind your screen. Choose a destination up to three steps away along connected locations, or stay where you are. The Scout can travel four steps. Lava-covered locations cannot be entered.

Clicking a location shares your provisional route. You can revise it until the team finishes planning. Click **Ready to travel** when satisfied. Neighboring players cannot choose the same destination. In a four-player game, your comparison neighbors are the players immediately before and after you in seating order, not the opposite player.

Discuss plans, but do not communicate exact dice values, counts, averages or statements that indirectly reveal those numbers. You may say that a destination looks promising or that your roll is poor. Wireless is an equipment exception that explicitly reveals dice.

The viewer picks a path that avoids eruption markers where possible. A location threatened by the next eruption requires an explicit danger acknowledgement before selection. Equipment marked for planning can be used during this phase.

### 2. Reroll in silence

Once everyone is ready, destinations are locked. Normal rerolls depend on the planned distance:

| Distance      | Rerolls |
| ------------- | ------: |
| Stay in place |       2 |
| 1–2 steps     |       1 |
| 3 steps       |       0 |

A destination marked ↻ grants one extra reroll. Survivalist adds one. An eye injury removes normal and location-bonus rerolls; Survivalist's extra reroll remains. A four-step Scout route grants no rerolls.

**One reroll can reroll any number of your dice together, including all of them.** Select the dice, then press Reroll. You may select different dice on each attempt or finish early. Having fewer dice does not itself reduce your reroll allowance.

Matching dice are marked with their contribution to your own destination. Colored player-number badges identify dice that also count against a teammate's destination. Buddy may set one die aside during this phase. The Gatherer collects unused rerolls as power bars, up to three.

### 3. Use equipment

Discussion resumes. You may use equipment available in this phase, then confirm readiness. Open a card to see its effect and select any required dice, location or recipient. Used equipment is discarded, except that Tinkerer may use a card twice. New equipment found on the trail becomes available next round.

Equipment can also create a decision for another player: a loan request may be accepted or declined, and a granted reroll lets its recipient choose dice. The viewer waits only for meaningful decisions.

### 4. Compare and move

All dice are revealed. For your destination, add the values of every die matching its symbols. For example, yellow-or-six counts yellow dice and all sixes, with each die counted once. Several listed numbers mean every die showing any of those numbers counts.

Compare your total against each comparison neighbor's dice using **your destination's criteria**. You must strictly beat both totals. A tie or lower result means you stay. In the simple two-player variant, the neutral dice provide the additional comparison.

The adaptation chooses movement order automatically, taking eruptions into account. A Gatherer may be asked whether to spend power bars; each bar adds one to the moving player's total. No one needs to confirm a movement that has no remaining choice.

Staying still also requires the dice comparison and can cost stamina. Moving successfully does not automatically mean zero stamina loss.

### 5. Lose stamina and advance lava

Your **lead** is your total minus the highest comparison total. At level 1:

| Lead         | Stamina lost |
| ------------ | -----------: |
| Tie or lower |            3 |
| 1–2          |            2 |
| 3–4          |            1 |
| 5 or more    |            0 |

At each higher difficulty, add one to the loss before applying the minimum of zero. Thus a level-4 tie loses six stamina, and a lead of eleven is needed to lose none. First aid prevents stamina loss for the round but does not make a failed comparison succeed.

The permanent guide below the map shows the table for the current difficulty. Difficulty changes stamina costs, not the normal movement distance, reroll allowance or lava speed.

Crossing the stamina thresholds at 20, 15, 10 and 5 remaining stamina gives an injury. Choose an injury you do not already have: arm prevents equipment use; eye reduces rerolls; amnesia removes your skill; leg permanently removes a die after the round's comparisons.

Crossing an eruption marker triggers its extra eruption(s). After all journeys are resolved, the ordinary eruption advances lava to every adjacent location. A player caught by lava, or reaching zero stamina, ends the expedition in defeat. These effects resolve automatically and appear in the journal.

## Equipment reference

| Equipment     | Effect                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binoculars    | During planning, swap any two completely empty land tiles, at any distance. No players, destination markers, equipment tokens, eruption markers, village tiles or lava. |
| Flare gun     | Add three to your own movement value this round. This bonus does not increase the total teammates must beat.                                                            |
| Rope          | Immediately move to an adjacent land tile during planning or equipment.                                                                                                 |
| Shovel        | Turn one die to any face.                                                                                                                                               |
| Torch         | During planning, reroll any selection of your dice once.                                                                                                                |
| Pocketknife   | Copy an eligible equipment card held by another player.                                                                                                                 |
| Water flask   | Take up to two rerolls yourself, or grant one to a teammate.                                                                                                            |
| First aid kit | Lose no stamina this round.                                                                                                                                             |
| Wireless      | Reveal your dice to everyone until the phase ends.                                                                                                                      |
| Tape          | Turn any of your ones into sixes.                                                                                                                                       |
| Compass       | Turn any of your sixes into ones.                                                                                                                                       |
| Machete       | Set aside one or two dice. They become visible but do not count this round.                                                                                             |
| Fire lighter  | Ask a teammate to lend you one die for the round.                                                                                                                       |
| Carabiner     | Every player must reroll exactly one die.                                                                                                                               |
| Map           | Lend one die to a teammate for the round.                                                                                                                               |

Set-aside and loaned dice return at the end of the round. The Equipment manager can give an equipment card to another player without being on the same location. The card's use phase and availability still apply.

## Winning and expedition points

You win together as soon as everyone stands on a village location. Reaching the village alone does not remove you from the game or protect you from later lava.

On victory, the viewer adds the team's expedition points: four per player, minus one per injury, plus one per remaining equipment card. It is a cooperative team score, not a competition between players.

## About this playtest

This is a private alpha. All seven scenarios, automatic movement ordering and simple two-player neutral dice are the supported configuration. The dice color/value composition was reconstructed from supplied photographs and is still awaiting publisher confirmation. Platform clocks and cooperative rankings are being evaluated during private testing; the in-game team outcome is authoritative.

Game design: Wolfgang Warsch. Illustrations: Weberson Santiago. Publisher: Feuerland Spiele. Source code: [Codeberg](https://codeberg.org/boardgamers/fuji), licensed under AGPL-3.0. Publisher artwork remains separately copyrighted.

If no other unclaimed destination is reachable, you can confirm staying even when a neighbor must stay there too. Play continues normally, including an eruption that may end the expedition.
