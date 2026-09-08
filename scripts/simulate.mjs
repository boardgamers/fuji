import { initGame, moveAI, replay } from "../packages/engine/dist/index.js";
import { currentPlayer } from "../packages/engine/dist/wrapper.js";
import assert from "node:assert/strict";
let moves = 0,
	wins = 0;
const scenarios = process.env.FUJI_ALL_SCENARIOS ? [1, 2, 3, 4, 5, 6, 7] : [1];
for (const scenario of scenarios)
	for (let players = 2; players <= 4; players++)
		for (let seed = 0; seed < 50; seed++) {
			let s = initGame(players, { difficulty: 1 + (seed % 4), scenario }, `simulation-${seed}`);
			let steps = 0;
			while (!s.outcome && steps < 1000) {
				const current = currentPlayer(s);
				const active = current === undefined ? [] : Array.isArray(current) ? current : [current];
				assert(active.length, "Active game must offer an action");
				const seat = active[0];
				s = moveAI(s, seat);
				assert.equal(
					new Set(s.players.flatMap((p) => p.dice.map((d) => d.id))).size,
					s.players.reduce((n, p) => n + p.dice.length, 0)
				);
				assert(s.players.every((p) => p.stamina >= 0 && p.stamina <= 25));
				steps++;
			}
			assert(s.outcome, `Deadlock: ${scenario}/${players}/${seed}`);
			assert.deepEqual(replay(s), s);
			moves += steps;
			if (s.outcome === "won") wins++;
		}
console.log(
	`${150 * scenarios.length} complete expeditions; ${moves} moves; ${wins} wins; no deadlocks; exact replays.`
);
