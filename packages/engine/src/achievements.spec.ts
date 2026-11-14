import test from "node:test";
import assert from "node:assert/strict";
import { achievementManifestSchema, achievementResultsSchema } from "@boardgamers/protocol/achievements";
import { inspectEngine } from "@boardgamers/protocol/engine";
import * as wrapper from "../wrapper.js";
import { initGame, replay, type State } from "../index.js";

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function finish(players: number, scenario: number | "random", difficulty: number, seed: string): State {
	let state = initGame(players, { scenario, difficulty }, seed);
	for (let moves = 0; !state.outcome && moves < 1000; moves++) {
		state = wrapper.moveAI(state, [wrapper.currentPlayer(state)].flat()[0]!);
	}
	assert.equal(state.phase, "ended");
	assert.deepEqual(replay(state), state);
	return json(state);
}
const win = finish(2, 1, 1, "achievement-0");
const ids = (state: State) => wrapper.achievements(state)[0]!.earned;

test("revision 2 manifest and optional hooks use the official published protocol", () => {
	const manifest = wrapper.achievementDefinitions();
	achievementManifestSchema.parse(manifest);
	assert.equal(manifest.revision, 2);
	assert.equal(manifest.achievements.length, 16);
	assert.equal(new Set(manifest.achievements.map((a) => a.id)).size, 16);
	for (const { id } of manifest.achievements) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
	assert(manifest.achievements.every((a) => a.id.length <= 64));
	const inspection = inspectEngine(wrapper);
	assert(inspection.compatible);
	assert(!inspection.optional.missing.includes("achievements"));
	assert(!inspection.optional.missing.includes("achievementDefinitions"));
	manifest.achievements[0]!.name = "mutated";
	assert.equal(wrapper.achievementDefinitions().achievements[0]!.name, "Escape Together");
});

test("every feat is attainable in legal completed, replayable expeditions; all seats share the win", () => {
	const earned = new Set<string>();
	for (const [players, scenario, difficulty, seed] of [
		[2, 1, 1, 0],
		[2, 3, 1, 0],
		[2, 5, 1, 0],
		[2, 6, 1, 0],
		[3, 1, 2, 1],
		[3, 2, 2, 1],
		[3, 4, 2, 1],
		[3, 6, 2, 1],
		[4, 1, 3, 2],
		[2, 2, 4, 3],
		[2, 7, 3, 18],
	] as const) {
		const state = finish(players, scenario, difficulty, `achievement-${seed}`);
		assert.equal(state.outcome, "won");
		const before = json(state);
		const result = wrapper.achievements(state);
		achievementResultsSchema(wrapper.achievementDefinitions(), players).parse(result);
		assert.deepEqual(result, wrapper.achievements(json(state)));
		assert.deepEqual(state, before, "evaluation leaves input and RNG unchanged");
		assert.equal(result.length, players);
		for (const [seat, row] of result.entries()) {
			assert.equal(row.seat, seat);
			assert.equal(row.outcome, "win");
			assert.deepEqual(row.earned, result[0]!.earned);
			row.earned.forEach((id) => earned.add(id));
			assert(row.earned.includes(`scenario-${scenario}-escape`));
			assert.equal(row.earned.filter((id) => id.startsWith("scenario-")).length, 1);
			for (let level = 2; level <= 4; level++)
				assert.equal(row.earned.includes(`difficulty-${level}-escape`), difficulty >= level);
		}
		result[0]!.earned.push("mutated");
		assert(!result[1]!.earned.includes("mutated"));
	}
	assert.deepEqual(
		[...earned].sort(),
		wrapper
			.achievementDefinitions()
			.achievements.map((a) => a.id)
			.sort()
	);
});

test("loss is cooperative even with tied ranks; incomplete and excluded sessions earn nothing", () => {
	const loss = finish(2, 2, 1, "achievement-0");
	assert.equal(loss.outcome, "lost");
	assert.deepEqual(wrapper.rankings(loss), [1, 1]);
	assert.deepEqual(
		wrapper.achievements(loss),
		[0, 1].map((seat) => ({ seat, outcome: "loss", earned: [] }))
	);
	assert.deepEqual(wrapper.achievements(initGame()), []);
	for (const flag of ["tutorial", "practice", "analysis"]) {
		const state = json(win);
		state.initOptions[flag] = true;
		assert.deepEqual(wrapper.achievements(state), []);
	}
	assert.deepEqual(wrapper.achievements(wrapper.createAnalysis(win, { to: win.log.length, sourceEnded: true })), []);
	assert.deepEqual(wrapper.achievements(wrapper.createAnalysisScenario(win, { seed: "analysis" })), []);
	const dropped = wrapper.dropPlayer(initGame(), 0);
	assert.deepEqual(
		wrapper.achievements(dropped),
		[0, 1, 2].map((seat) => ({ seat, outcome: "loss", earned: [] }))
	);
	assert.deepEqual(wrapper.achievements({ ...win, outcome: null }), []);
});

test("random scenarios award only the resolved scenario", () => {
	const state = finish(2, "random", 1, "achievement-0");
	assert.equal(state.outcome, "won");
	assert.equal(state.initOptions.scenario, "random");
	assert.deepEqual(
		ids(state).filter((id) => id.startsWith("scenario-")),
		[`scenario-${state.scenario}-escape`]
	);
});

test("isolated predicate boundaries use remaining stamina, pending injuries and held equipment", () => {
	// These are predicate probes, not presented as legal completed-game fixtures.
	const state = json(win);
	state.players.forEach((p) => {
		p.stamina = 14;
		p.injuries = [];
		p.pendingInjuries = 0;
	});
	assert(ids(state).includes("strength-to-spare"));
	state.players[0]!.stamina = 15;
	assert(!ids(state).includes("strength-to-spare"));
	state.players[0]!.stamina = 19;
	assert(!ids(state).includes("narrow-escape"));
	state.players[0]!.stamina = 20;
	assert(ids(state).includes("narrow-escape"));
	assert(ids(state).includes("unscathed-team"));
	state.players[0]!.pendingInjuries = 1;
	assert(!ids(state).includes("unscathed-team"));
	state.players[0]!.pendingInjuries = 0;
	state.players[0]!.injuries = ["amnesia"];
	assert(!ids(state).includes("unscathed-team"));
	state.players[0]!.cards = [];
	assert(!ids(state).includes("well-equipped"));
	state.scenario = undefined;
	assert(!ids(state).some((id) => id.startsWith("scenario-")), "legacy unknown scenario is not invented");
	state.phase = "planning";
	assert.deepEqual(wrapper.achievements(state), []);
});
