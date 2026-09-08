import {
	initGame,
	chooseMove,
	stripSecret,
	applyMove,
	replay,
	DEFAULT_AI_POLICY,
} from "../packages/engine/dist/index.js";
import { currentPlayer } from "../packages/engine/dist/wrapper.js";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const base = { ...DEFAULT_AI_POLICY, success: 12, stamina: 2, lead: 1, progress: 4 };
const variants = {
	baseline: { ...base, equipment: false },
	balanced: { ...base },
	stamina: { ...base, success: 8, stamina: 4 },
	escape: { ...base, success: 18, stamina: 1 },
	cautious: { ...base, lead: 1.5 },
	progress: { ...base, progress: 5 },
};
function run(name, policy, family, count) {
	const result = {
		name,
		policy,
		family,
		games: 0,
		wins: 0,
		moves: 0,
		stalled: [],
		byPlayers: {},
		equipment: {},
		abilities: {},
	};
	for (let players = 2; players <= 4; players++)
		for (let seed = 0; seed < count; seed++) {
			let state = initGame(players, { difficulty: 1 + (seed % 4) }, `ai-${family}-${seed}`),
				steps = 0;
			while (!state.outcome && steps < 1000) {
				const current = currentPlayer(state),
					seat = Array.isArray(current) ? current[0] : current;
				assert.notEqual(seat, undefined);
				let move;
				try {
					move = chooseMove(stripSecret(state, seat), seat, policy);
				} catch (error) {
					result.stalled.push({ players, seed, round: state.round, error: String(error) });
					break;
				}
				try {
					state = applyMove(state, move, seat);
				} catch (error) {
					throw new Error(`${name}/${players}/${seed}/${steps}: ${JSON.stringify(move)}`, { cause: error });
				}
				if (move.action === "equipment")
					result.equipment[move.copy ?? move.id] = (result.equipment[move.copy ?? move.id] ?? 0) + 1;
				if (["buddy", "give", "help"].includes(move.action))
					result.abilities[move.action] = (result.abilities[move.action] ?? 0) + 1;
				steps++;
			}
			if (!state.outcome && steps >= 1000) result.stalled.push({ players, seed, error: "Move limit" });
			if (seed % 10 === 0) assert.deepEqual(replay(state), state);
			result.games++;
			result.moves += steps;
			const won = state.outcome === "won" ? 1 : 0;
			result.wins += won;
			result.byPlayers[players] ??= { games: 0, wins: 0 };
			result.byPlayers[players].games++;
			result.byPlayers[players].wins += won;
		}
	console.log(JSON.stringify(result));
	return result;
}
const training = Object.entries(variants).map(([name, policy]) => run(name, policy, "training", 60));
const winner = training.filter((r) => r.name !== "baseline" && !r.stalled.length).sort((a, b) => b.wins - a.wins)[0];
const heldout = [run("baseline", variants.baseline, "heldout", 100), run(winner.name, winner.policy, "heldout", 100)];
writeFileSync("docs/ai-benchmark.json", JSON.stringify({ training, heldout }, null, 2) + "\n");
