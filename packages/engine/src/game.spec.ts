import test from "node:test";
import assert from "node:assert/strict";
import {
	initGame,
	applyMove,
	stripSecret,
	comparison,
	cell,
	terrain,
	paths,
	rerollAllowance,
	face,
	matches,
	replay,
	threatened,
	activePlayers,
} from "../index.js";
import type { State, Move } from "./types.js";
function prepared(players = 3) {
	let s = initGame(players, {}, "test-seed");
	for (let i = 0; i < players; i++) {
		const p = s.players[i]!;
		if (p.setupDone) continue;
		const keep = p.cards.slice(0, p.skill === "manager" ? 2 : 1).map((c) => c.id);
		s = applyMove(s, { action: "setup", keep, drop: p.dice.at(-1)?.id }, i);
	}
	return s;
}
function withPhase(phase: State["phase"] = "equipment") {
	const s = prepared();
	s.phase = phase;
	s.players.forEach((p) => (p.ready = false));
	return s;
}
function equip(s: State, seat: number, id: string, extra: Record<string, unknown> = {}) {
	s.players[seat]!.cards = [{ id: id as never, used: 0, availableRound: 0 }];
	return applyMove(s, { action: "equipment", id, ...extra }, seat);
}
test("scenario 1 includes exactly 21 landscape locations and player-count village slot", () => {
	const a = initGame(3),
		b = initGame(4);
	assert.equal(a.board.filter((c) => terrain(c.terrain).kind === "land").length, 21);
	assert.equal(a.board.filter((c) => terrain(c.terrain).kind === "village").length, 5);
	assert.equal(b.board.filter((c) => terrain(c.terrain).kind === "village").length, 6);
	assert.equal(b.players[2]!.position, "1,2");
	assert.equal(new Set(a.board.map((c) => c.terrain)).size, a.board.length);
});
test("preparation only waits for actual card or die choices", () => {
	const s = initGame(4);
	assert.deepEqual(
		s.players.map((p) => p.setupDone),
		[true, true, false, false]
	);
	assert.deepEqual(activePlayers(s), [2, 3]);
	assert.equal(s.phase, "setup");
	assert.equal(s.history.length, 0);
	const scout = initGame(2, { skills: ["buddy", "scout"] });
	assert.deepEqual(activePlayers(scout), [1]);
});
test("an expedition without preparation choices starts round one immediately", () => {
	const s = initGame(2, {}, "automatic-preparation");
	assert.equal(s.phase, "planning");
	assert.equal(s.round, 1);
	assert(s.players.every((p) => p.setupDone));
	assert.deepEqual(activePlayers(s), [0, 1]);
	assert.equal(s.history.length, 0);
	assert.deepEqual(replay(s), s);
});
test("seeded setup, rolls and JSON round trips are deterministic", () => {
	assert.deepEqual(prepared(), prepared());
	let a = withPhase("reroll");
	a.players[0]!.rerolls = 1;
	let b = JSON.parse(JSON.stringify(a));
	const move = { action: "reroll", ids: [a.players[0]!.dice[0]!.id] };
	assert.deepEqual(applyMove(a, move, 0), applyMove(b, move, 0));
});
test("invalid moves never mutate input, consume randomness or append logs", () => {
	const s = prepared(),
		before = structuredClone(s);
	assert.throws(() => applyMove(s, { action: "plan", path: ["0,3", "7,0"] }, 0));
	assert.deepEqual(s, before);
	assert.throws(() => applyMove(s, { action: "reroll", ids: ["0-0"] }, 0));
	assert.deepEqual(s, before);
	assert.throws(() => applyMove(s, { action: "ready" }, 12));
});
test("requirements use union for colour OR value, intersection for colour AND parity", () => {
	assert(matches({ color: "blue", value: 6 }, { colors: ["yellow"], values: [6], combine: "or" }));
	assert(matches({ color: "yellow", value: 6 }, { colors: ["yellow"], values: [6], combine: "or" }));
	assert(!matches({ color: "pink", value: 4 }, { colors: ["blue"], parity: "even" }));
	assert(matches({ color: "blue", value: 4 }, { colors: ["blue"], parity: "even" }));
	assert(!matches({ color: "blue", value: 3 }, { colors: ["blue"], parity: "even" }));
});
test("private projection removes seed, RNG, deck order and move history at every phase", () => {
	for (const phase of ["planning", "reroll", "equipment"] as const) {
		const s = withPhase(phase);
		const v = stripSecret(s, 0);
		assert(!("seed" in v));
		assert(!("counter" in v));
		assert(!("history" in v));
		assert(!("deck" in v));
		assert(!("initOptions" in v));
		assert(v.players[0]!.dice.every((d) => d.face > 0));
		assert(v.players[1]!.dice.every((d) => d.face === 0));
		assert(stripSecret(s).players.every((p) => p.dice.every((d) => !d.face)));
		assert(s.players[1]!.dice.every((d) => d.face > 0));
	}
});
test("wireless and set-aside dice reveal only intended information", () => {
	let s = withPhase();
	s.players[1]!.dice[0]!.aside = true;
	s = equip(s, 2, "radio");
	const v = stripSecret(s, 0);
	assert(v.players[1]!.dice[0]!.face > 0);
	assert(v.players[1]!.dice.slice(1).every((d) => !d.face));
	assert(v.players[2]!.dice.every((d) => d.face > 0));
});
test("two-player neutral set has three visible and three hidden dice", () => {
	const s = prepared(2),
		v = stripSecret(s, 0);
	assert.equal(v.ghost.filter((d) => d.face).length, 3);
	s.phase = "movement";
	assert.equal(stripSecret(s, 0).ghost.filter((d) => d.face).length, 6);
	assert.equal(comparison(s, 0).peers.length, 2);
});
test("no route crosses rubble or moves diagonally; movement length affects rerolls", () => {
	const s = prepared();
	assert(!paths(s, 0)["0,2"]);
	assert.equal(rerollAllowance(s, 0, ["0,3"]), 2 + (terrain(cell(s, "0,3").terrain).reroll ? 1 : 0));
	assert.throws(() => applyMove(s, { action: "plan", path: ["0,3", "1,4"] }, 0));
});
test("neighbors cannot confirm the same destination", () => {
	let s = prepared();
	s = applyMove(s, { action: "ready" }, 0);
	assert.throws(() => applyMove(s, { action: "ready" }, 1), /different destinations/);
});
test("comparison is strict; ties fail and cost maximum stamina", () => {
	const s = withPhase("movement");
	s.board.find((c) => c.id === "0,3")!.terrain = 16;
	s.players.forEach((p) => p.dice.forEach((d) => (d.face = 2)));
	assert.equal(comparison(s, 0).success, false);
	assert.equal(comparison(s, 0).loss, 3);
	s.players[0]!.dice[0]!.face = 3;
	assert.equal(comparison(s, 0).success, true);
	assert.equal(comparison(s, 0).loss, 2);
	s.players[0]!.aid = true;
	assert.equal(comparison(s, 0).loss, 0);
});
test("eruption propagates one wave, including rubble; no recursive flood in one action", () => {
	const s = withPhase("eruption");
	const next = threatened(s);
	assert.deepEqual(next, ["0,1"]);
	const a = applyMove(s, { action: "erupt" }, 0);
	assert(cell(a, "0,1").lava);
	assert(!cell(a, "0,2").lava);
	assert.equal(a.round, 2);
	assert.equal(a.phase, "planning");
});
test("eruption ends the game immediately if any player is caught", () => {
	const s = withPhase("eruption");
	cell(s, "0,2").lava = true;
	const a = applyMove(s, { action: "erupt" }, 0);
	assert.equal(a.outcome, "lost");
	assert.equal(a.phase, "ended");
});
test("win occurs as soon as everyone reaches village, before stamina or eruption", () => {
	const s = withPhase("movement");
	const v = s.board.find((c) => terrain(c.terrain).kind === "village")!;
	v.terrain = 16;
	v.terrain = 28;
	s.players.forEach((p) => {
		p.position = v.id;
		p.path = [v.id];
	});
	s.players[0]!.stamina = 24;
	s.players[0]!.bonus = 100;
	s.activeResolution = 0;
	const a = applyMove(s, { action: "resolve" }, 0);
	assert.equal(a.outcome, "won");
	assert.equal(a.players[0]!.stamina, 24);
});
test("leg injury removes a die only after all movement comparisons", () => {
	const s = withPhase("movement");
	s.activeResolution = 0;
	s.players[0]!.pendingInjuries = 1;
	s.players[0]!.resolved = true;
	const id = s.players[0]!.dice[0]!.id;
	let a = applyMove(s, { action: "injury", injury: "leg", die: id }, 0);
	assert.equal(a.players[0]!.dice.length, 6);
	assert(a.players[0]!.dice[0]!.remove);
	a.players.forEach((p) => (p.resolved = true));
	a.phase = "eruption";
	a = applyMove(a, { action: "erupt" }, 0);
	assert.equal(a.players[0]!.dice.length, 5);
});
test("a borrowed die returns to its owner after the round", () => {
	let s = withPhase();
	const id = s.players[0]!.dice[0]!.id;
	s = equip(s, 0, "map", { target: 1, ids: [id] });
	assert.equal(s.players[0]!.dice.length, 5);
	assert(s.players[1]!.dice.some((d) => d.id === id));
	s.phase = "eruption";
	s = applyMove(s, { action: "erupt" }, 0);
	assert(s.players[0]!.dice.some((d) => d.id === id));
	assert.equal(s.players[1]!.dice.length, 6);
});
test("lighter waits for donor consent instead of choosing a hidden die", () => {
	let s = withPhase();
	s = equip(s, 0, "lighter", { target: 1 });
	assert.deepEqual(activePlayers(s), [1]);
	assert.throws(() => applyMove(s, { action: "respond", ids: [s.players[1]!.dice[0]!.id] }, 0));
	s = applyMove(s, { action: "decline" }, 1);
	assert.equal(s.pending, null);
	assert.equal(s.players[0]!.dice.length, 6);
});
test("carabiner requires exactly one die from every player", () => {
	let s = equip(withPhase(), 0, "carabiner");
	assert.throws(() => applyMove(s, { action: "decline" }, 0));
	assert.throws(() => applyMove(s, { action: "respond", ids: [] }, 0));
	for (let i = 0; i < 3; i++) s = applyMove(s, { action: "respond", ids: [s.players[i]!.dice[0]!.id] }, i);
	assert.equal(s.pending, null);
});
test("water permits two distinct reroll choices and early stopping", () => {
	let s = equip(withPhase(), 0, "water", { target: 0 });
	s = applyMove(s, { action: "respond", ids: [s.players[0]!.dice[0]!.id] }, 0);
	assert.equal(s.pending?.remaining, 1);
	s = applyMove(s, { action: "decline" }, 0);
	assert.equal(s.pending, null);
});
test("gatherer caps stored bars and applies them only to active movement total", () => {
	let s = withPhase("reroll");
	s.players[1]!.powerBars = 2;
	s.players[1]!.rerolls = 3;
	s = applyMove(s, { action: "finishRerolls" }, 1);
	assert.equal(s.players[1]!.powerBars, 3);
	s.phase = "movement";
	s.activeResolution = 0;
	const before = comparison(s, 0).own;
	s = applyMove(s, { action: "bar" }, 1);
	assert.equal(comparison(s, 0).own, before + 1);
	assert.equal(s.players[1]!.bonus, 0);
});
test("tinkerer gets two uses; amnesia discards partially used equipment", () => {
	let s = withPhase();
	s.players[0]!.skill = "tinkerer";
	s = equip(s, 0, "aid");
	assert.equal(s.players[0]!.cards[0]!.used, 1);
	s.phase = "movement";
	s.players[0]!.pendingInjuries = 1;
	s = applyMove(s, { action: "injury", injury: "amnesia" }, 0);
	assert.equal(s.players[0]!.cards.length, 0);
	assert(s.discard.includes("aid"));
});
test("replay reconstructs setup and planning without divergence", () => {
	let s = prepared();
	s = applyMove(s, { action: "plan", path: ["0,3", "1,3"] }, 0);
	assert.deepEqual(replay(s), s);
});
test("all color-changing equipment preserves the inferred die type", () => {
	let s = withPhase();
	s.players[0]!.dice.forEach((d) => (d.face = 1));
	const ids = s.players[0]!.dice.map((d) => d.id);
	const colors = s.players[0]!.dice.map((d) => face(d).color);
	s = equip(s, 0, "tape", { ids });
	assert(s.players[0]!.dice.every((d) => d.face === 6));
	assert.deepEqual(
		s.players[0]!.dice.map((d) => face(d).color),
		colors
	);
	s = equip(s, 0, "compass", { ids });
	assert(s.players[0]!.dice.every((d) => d.face === 1));
	s = equip(s, 0, "shovel", { ids: [ids[0]], face: 3 });
	assert.equal(s.players[0]!.dice[0]!.face, 3);
	assert.equal(face(s.players[0]!.dice[0]!).color, "pink");
});
test("binoculars swap only completely empty landscape cards", () => {
	let s = withPhase("planning");
	const available = s.board.filter(
		(c) =>
			!c.lava &&
			!c.equipment &&
			!c.eruption &&
			terrain(c.terrain).kind === "land" &&
			!s.players.some((p) => p.position === c.id)
	);
	const a = available[0]!,
		b = available[1]!;
	const before = [a.terrain, b.terrain];
	s = equip(s, 0, "binoculars", { tiles: [a.id, b.id] });
	assert.deepEqual([cell(s, a.id).terrain, cell(s, b.id).terrain], before.reverse());
	assert.throws(() => equip(s, 0, "binoculars", { tiles: [s.players[0]!.position, b.id] }));
});
test("rope moves immediately and keeps equipment found unavailable until the next round", () => {
	let s = withPhase("planning");
	const destination = cell(s, "1,3");
	destination.equipment = true;
	const before = s.players[0]!.cards.length;
	s = equip(s, 0, "rope", { tiles: [destination.id] });
	assert.equal(s.players[0]!.position, destination.id);
	assert.equal(cell(s, destination.id).equipment, false);
	assert(s.players[0]!.cards.some((c) => c.availableRound === s.round + 1));
});
test("pocketknife copies without consuming the original equipment", () => {
	let s = withPhase();
	s.players[1]!.cards = [{ id: "aid", used: 0, availableRound: 0 }];
	s = equip(s, 0, "knife", { copy: "aid" });
	assert(s.players[0]!.aid);
	assert(s.players[1]!.cards.some((c) => c.id === "aid"));
	assert(!s.players[0]!.cards.length);
});
test("eye injury retains Survivalist bonus; Scout four-step route has no rerolls", () => {
	const s = prepared();
	s.players[0]!.skill = "survivalist";
	s.players[0]!.injuries = ["eye"];
	assert.equal(rerollAllowance(s, 0), 1);
	s.players[0]!.skill = "scout";
	s.players[0]!.injuries = [];
	assert.equal(rerollAllowance(s, 0, ["0,3", "1,3", "1,4", "2,4", "3,4"]), 0);
});
test("readiness can be revised before simultaneous planning closes", () => {
	let s = prepared();
	s = applyMove(s, { action: "ready" }, 0);
	assert(activePlayers(s).includes(0));
	s = applyMove(s, { action: "plan", path: ["0,3", "1,3"] }, 0);
	assert(!s.players[0]!.ready);
});
test("metadata and player drops replay exactly without exposing system actions to players", async () => {
	const { setPlayerName, dropGamePlayer } = await import("./game.js");
	let s = setPlayerName(prepared(), 0, "Alice");
	s = dropGamePlayer(s, 1);
	assert.deepEqual(replay(s), s);
	assert.throws(() => applyMove(prepared(), { action: "$drop" }, 0));
});

test("BGS route edits and provisional readiness are live; drops retain turn handling", async () => {
	const wrapper = await import("../wrapper.js");
	const initial = prepared();
	assert.equal(wrapper.isLiveUpdate(initial), false);
	const planned = applyMove(initial, { action: "plan", path: [initial.players[0]!.position] }, 0);
	assert.equal(wrapper.isLiveUpdate(planned), true);
	assert.deepEqual(wrapper.currentPlayer(planned), wrapper.currentPlayer(initial));
	assert.equal(wrapper.isLiveUpdate(JSON.parse(JSON.stringify(planned))), true);
	assert.equal(wrapper.isLiveUpdate(replay(planned)), true);
	const confirmed = applyMove(planned, { action: "ready" }, 0);
	assert.equal(wrapper.isLiveUpdate(confirmed), true);
	const revised = applyMove(confirmed, { action: "plan", path: [confirmed.players[0]!.position] }, 0);
	assert.equal(wrapper.isLiveUpdate(revised), true);
	assert.deepEqual(wrapper.currentPlayer(revised), wrapper.currentPlayer(confirmed));
	assert.equal(wrapper.isLiveUpdate(wrapper.dropPlayer(revised, 0)), false);
	assert.equal(wrapper.isLiveUpdate(wrapper.setPlayerMetaData(revised, 0, { name: "Explorer" })), false);
});

test("100 planning revisions keep history and public log bounded and replay exactly", async () => {
	const wrapper = await import("../wrapper.js");
	let s = prepared();
	const historyLength = s.history.length;
	const logLength = s.log.length;
	for (let i = 0; i < 100; i++) {
		const seat = i % 2;
		const path = Object.values(paths(s, seat)).find(
			(path) => !s.players.some((p, j) => j !== seat && p.ready && p.path.at(-1) === path.at(-1))
		)!;
		s = applyMove(s, { action: "plan", path }, seat);
		s = applyMove(s, { action: "ready" }, seat);
		assert.equal(wrapper.isLiveUpdate(s), true);
		assert.equal(s.history.length, historyLength);
		assert.equal(s.log.length, logLength);
	}
	assert.deepEqual(replay(JSON.parse(JSON.stringify(s))), s);
	assert.equal("planningSnapshot" in stripSecret(s, 0), false);
	assert.equal("liveUpdate" in stripSecret(s, 0), false);
	const lastPath = Object.values(paths(s, 2)).find(
		(path) => !s.players.some((p, j) => j !== 2 && p.path.at(-1) === path.at(-1))
	)!;
	s = applyMove(s, { action: "plan", path: lastPath }, 2);
	s = applyMove(s, { action: "ready" }, 2);
	assert.equal(s.phase, "reroll");
	assert.equal(wrapper.isLiveUpdate(s), false);
	assert.equal(s.history.length, historyLength + 2);
	const partial = replay(s, historyLength + 1);
	assert.equal(partial.phase, "planning");
	assert.equal(wrapper.isLiveUpdate(partial), true);
	assert.deepEqual(replay(partial), partial);
	assert.equal(s.planningSnapshot, undefined);
	assert.deepEqual(replay(s), s);
	assert.throws(() => applyMove(s, { action: "plan", path: [s.players[0]!.position] }, 0));
});

test("metadata and drops checkpoint live planning without losing replay", async () => {
	const wrapper = await import("../wrapper.js");
	let s = prepared();
	s = applyMove(s, { action: "plan", path: [s.players[0]!.position] }, 0);
	s = wrapper.setPlayerMetaData(s, 1, { name: "Climber" });
	assert.deepEqual(replay(s), s);
	s = applyMove(s, { action: "ready" }, 0);
	s = wrapper.dropPlayer(s, 1);
	assert.equal(wrapper.isLiveUpdate(s), false);
	assert.deepEqual(replay(s), s);
});

test("movement resolves immediately when no Gatherer has usable bars", () => {
	let s = withPhase("movement");
	s = applyMove(s, { action: "beginMovement" }, 0);
	assert.equal(s.players[0]!.resolved, true);
	assert.equal(s.pendingHelpers, undefined);
	assert(s.log.some((e) => e.text.startsWith("Dice comparison at")));
	assert.equal(s.log.filter((e) => e.diceLabel?.includes("matching total")).length, 3);
});

test("only the Gatherer decides zero or multiple bars, then movement resolves", () => {
	for (const count of [0, 1, 3]) {
		let s = withPhase("movement");
		s.players[1]!.powerBars = 3;
		s = applyMove(s, { action: "beginMovement" }, 0);
		assert.deepEqual(activePlayers(s), [1]);
		assert.equal(s.players[0]!.resolved, false);
		const before = structuredClone(s);
		assert.throws(() => applyMove(s, { action: "resolve" }, 0));
		assert.throws(() => applyMove(s, { action: "help", count: 4 }, 1));
		assert.throws(() => applyMove(s, { action: "help", count: 1 }, 0));
		assert.deepEqual(s, before);
		s = applyMove(s, { action: "help", count }, 1);
		assert.equal(s.players[1]!.powerBars, 3 - count);
		assert.equal(s.players[0]!.bonus, count);
		assert.equal(s.players[0]!.resolved, true);
		assert.throws(() => applyMove(s, { action: "help", count }, 1));
	}
});

test("Gatherer can help themselves; multiple Gatherers each decide once", () => {
	let s = withPhase("movement");
	s.players[0]!.skill = "gatherer";
	s.players[0]!.powerBars = 1;
	s.players[1]!.powerBars = 2;
	s = applyMove(s, { action: "beginMovement" }, 0);
	assert.deepEqual(activePlayers(s), [0, 1]);
	s = applyMove(s, { action: "help", count: 1 }, 0);
	assert.deepEqual(activePlayers(s), [1]);
	assert.equal(s.players[0]!.resolved, false);
	s = applyMove(s, { action: "help", count: 0 }, 1);
	assert.equal(s.players[0]!.resolved, true);
});

test("revealed dice and matching dice are immutable public journal snapshots", () => {
	let s = withPhase("equipment");
	assert(!s.log.some((e) => e.dice));
	for (let i = 0; i < 3; i++) s = applyMove(s, { action: "ready" }, i);
	const reveal = s.log.find((e) => e.diceLabel?.includes("revealed"))!;
	assert.deepEqual(reveal.dice, s.players[0]!.dice);
	const snapshot = structuredClone(reveal.dice);
	s.players[0]!.dice[0]!.aside = true;
	s = applyMove(s, { action: "beginMovement" }, 0);
	const matched = s.log.filter((e) => e.diceLabel?.includes("matching total"));
	assert.equal(matched.length, 3);
	assert(matched.every((e) => e.dice!.every((d) => !d.aside)));
	assert.deepEqual(s.log.find((e) => e.diceLabel?.includes("revealed"))!.dice, snapshot);
	assert.deepEqual(stripSecret(s).log, s.log);
});
