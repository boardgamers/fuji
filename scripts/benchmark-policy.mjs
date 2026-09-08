import fs from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const [name = "current", family = "training", countArg = "8"] = process.argv.slice(2);
const dir = pathToFileURL(resolve(process.env.FUJI_BENCH_ENGINE ?? "packages/engine/dist") + "/");
const output = resolve("work/benchmarks");
fs.mkdirSync(output, { recursive: true });
const { initGame, chooseMove, stripSecret, applyMove, replay, DEFAULT_AI_POLICY } = await import(
	new URL("index.js", dir)
);
const { currentPlayer } = await import(new URL("wrapper.js", dir));
const tweaks = {
	current: {},
	old: {},
	route: {},
	frugal: { cost: 1.5 },
	generous: { cost: 0.3 },
	stamina: { stamina: 3 },
	teamwork: { teamwork: 0.8 },
};
const policy = { ...DEFAULT_AI_POLICY, ...tweaks[name] };
const result = { name, family, policy, games: 0, wins: 0, moves: 0, byScenario: {}, equipment: {}, stalled: [] };
for (let scenario = 1; scenario <= 7; scenario++) {
	for (let players = 2; players <= 4; players++)
		for (let seed = 0; seed < Number(countArg); seed++) {
			let g = initGame(players, { scenario, difficulty: 1 + (seed % 4) }, `detour-${family}-${seed}`),
				n = 0;
			while (!g.outcome && n < 1000) {
				const cp = currentPlayer(g),
					seat = Array.isArray(cp) ? cp[0] : cp;
				assert.notEqual(seat, undefined);
				const m = chooseMove(stripSecret(g, seat), seat, policy);
				g = applyMove(g, m, seat);
				if (m.action === "equipment") result.equipment[m.copy ?? m.id] = (result.equipment[m.copy ?? m.id] ?? 0) + 1;
				n++;
			}
			if (!g.outcome) result.stalled.push({ scenario, players, seed });
			assert.deepEqual(replay(g), g);
			result.games++;
			result.moves += n;
			const won = Number(g.outcome === "won");
			result.wins += won;
			result.byScenario[scenario] ??= { games: 0, wins: 0 };
			result.byScenario[scenario].games++;
			result.byScenario[scenario].wins += won;
		}
	fs.writeFileSync(resolve(output, `${name}-${family}.json`), JSON.stringify(result, null, 2));
	console.log(name, scenario, result.games, result.wins);
}
