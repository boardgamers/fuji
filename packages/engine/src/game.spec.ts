import test from "node:test";
import assert from "node:assert/strict";
import {
	initGame as createGame,
	choosePowerBars,
	applyMove,
	stripSecret,
	comparison,
	powerBarChoices,
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
// Existing rule fixtures deliberately use the legacy roster to isolate each rule.
const initGame = (players = 3, options: Record<string, unknown> = {}, seed = "fuji") =>
	createGame(players, { skillAssignment: "fixed", ...options }, seed);
function prepared(players = 3) {
	let s = initGame(players, { autoMovement: false, autoProgress: false }, "test-seed");
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
	assert.deepEqual(wrapper.currentPlayer(confirmed), [1, 2]);
	assert.deepEqual(wrapper.currentPlayer(revised), [0, 1, 2]);
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

test("automatic movement moves an exposed teammate before triggering lava", () => {
	const s = withPhase("equipment");
	s.initOptions.autoMovement = true;
	s.board = Array.from({ length: 5 }, (_, x) => ({
		id: `${x},0`,
		x,
		y: 0,
		terrain: x === 0 ? 1 : 16,
		lava: x === 0,
		equipment: false,
		eruption: x === 2 ? 1 : 0,
	}));
	for (const [i, p] of s.players.entries()) {
		p.position = `${[3, 1, 4][i]},0`;
		p.path = i === 2 ? [p.position] : [p.position, "2,0"];
		p.bonus = 100;
		p.ready = i !== 2;
	}
	// Both arrivals trigger the same marker. Moving player 0 first kills player 1.
	const manual = structuredClone(s);
	manual.initOptions.autoMovement = false;
	let bad = applyMove(manual, { action: "ready" }, 2);
	bad = applyMove(bad, { action: "beginMovement" }, 0);
	assert.equal(bad.outcome, "lost");
	const before = structuredClone(s);
	const safe = applyMove(s, { action: "ready" }, 2);
	assert.deepEqual(s, before);
	assert.equal(safe.outcome, null);
	assert.equal(safe.phase, "eruption");
	assert.equal(safe.players[1]!.position, "2,0");
	const order = safe.log.filter((e) => e.text.includes("is resolving their journey"));
	assert.equal(order.length, 3);
	assert(
		order.findIndex((e) => e.text.startsWith(s.players[1]!.name)) <
			order.findIndex((e) => e.text.startsWith(s.players[0]!.name))
	);
	assert.equal(safe.counter, s.counter);
});

test("automatic movement pauses for bars, without spending them or adding synthetic moves", () => {
	let s = withPhase("equipment");
	s.initOptions.autoMovement = true;
	s.players.forEach((p, i) => {
		p.ready = i !== 2;
		p.bonus = 100;
	});
	s.players[1]!.powerBars = 2;
	const historyLength = s.history.length;
	s = applyMove(s, { action: "ready" }, 2);
	assert.deepEqual(activePlayers(s), [1]);
	assert.equal(s.players[1]!.powerBars, 2);
	assert.equal(s.history.length, historyLength + 1);
	assert.equal(s.players.filter((p) => p.resolved).length, 0);
	for (let i = 0; i < 3; i++) s = applyMove(s, { action: "help", count: 0 }, 1);
	assert.equal(s.phase, "eruption");
	assert.equal(s.players[1]!.powerBars, 2);
	assert.equal(s.history.length, historyLength + 4);
});

test("automatic movement resumes after a player's injury choice", () => {
	let s = withPhase("equipment");
	s.initOptions.autoMovement = true;
	cell(s, "0,3").terrain = 16;
	s.players.forEach((p, i) => {
		p.ready = i !== 2;
		p.dice.forEach((d) => (d.face = 2));
	});
	s.players[0]!.stamina = 4;
	s = applyMove(s, { action: "ready" }, 2);
	assert.deepEqual(activePlayers(s), [0]);
	assert.equal(s.players[0]!.pendingInjuries, 1);
	s = applyMove(s, { action: "injury", injury: "eye" }, 0);
	assert.equal(s.phase, "eruption");
	assert(s.players.every((p) => p.resolved));
});

test("giving equipment clears readiness and is a definitive action", async () => {
	const wrapper = await import("../wrapper.js");
	for (const phase of ["planning", "equipment"] as const) {
		let s = withPhase(phase);
		s.players[2]!.cards = [{ id: "torch", used: 0, availableRound: 1 }];
		s.players[0]!.ready = true;
		if (phase === "planning")
			s = applyMove(s, { action: "plan", path: Object.values(paths(s, 2)).find((path) => path.length > 1)! }, 2);
		const before = structuredClone(s);
		const next = applyMove(s, { action: "give", id: "torch", target: 0 }, 2);
		assert.deepEqual(s, before);
		assert.equal(next.players[0]!.ready, false);
		assert(next.players[0]!.cards.some((c) => c.id === "torch"));
		assert.equal(wrapper.isLiveUpdate(next), false);
		assert.equal(next.history.at(-1)!.move.action, "give");
		assert(activePlayers(next).includes(0));
	}
});

test("reroll phase skips exhausted players but preserves the Buddy choice", () => {
	let s = withPhase("reroll");
	s.players[0]!.rerolls = 0;
	s.players[1]!.rerolls = 1;
	s.players[2]!.rerolls = 0;
	s = applyMove(s, { action: "reroll", ids: [s.players[1]!.dice[0]!.id] }, 1);
	assert.equal(s.phase, "reroll");
	assert.deepEqual(activePlayers(s), [0]);
	assert.equal(s.players[1]!.ready, true);
	assert.equal(s.players[2]!.ready, true);
	s = applyMove(s, { action: "buddy", ids: [s.players[0]!.dice[0]!.id] }, 0);
	assert.equal(s.phase, "equipment");
});

test("Gatherer keeps the choice to use or forfeit remaining rerolls", () => {
	let s = withPhase("reroll");
	s.players[1]!.rerolls = 2;
	s = applyMove(s, { action: "finishRerolls" }, 0);
	assert.deepEqual(activePlayers(s), [1]);
	assert.equal(s.players[1]!.powerBars, 0);
	s = applyMove(s, { action: "finishRerolls" }, 1);
	assert.equal(s.players[1]!.powerBars, 2);
	assert.equal(s.phase, "equipment");
});

test("equipment skips empty hands but keeps choices and concealed dice private", () => {
	let s = withPhase("reroll");
	s.initOptions.autoProgress = true;
	s.players[0]!.cards = [];
	s.players[1]!.cards = [{ id: "torch", used: 0, availableRound: 0 }];
	s.players[2]!.cards = [{ id: "tape", used: 0, availableRound: 0 }];
	s.players[2]!.skill = "buddy";
	s.players[2]!.buddyUsed = true;
	s.players[2]!.dice.forEach((d) => (d.face = 6));
	s = applyMove(s, { action: "finishRerolls" }, 0);
	assert.equal(s.phase, "equipment");
	assert.deepEqual(
		s.players.map((p) => p.ready),
		[true, true, false]
	);
});

test("equipment transfer reopens an automatically passed recipient", () => {
	let s = withPhase("equipment");
	s.initOptions.autoProgress = true;
	s.players[0]!.cards = [];
	s.players[0]!.ready = true;
	s.players[2]!.cards = [{ id: "machete", used: 0, availableRound: 0 }];
	s = applyMove(s, { action: "give", id: "machete", target: 0 }, 2);
	assert.equal(s.phase, "equipment");
	assert.equal(s.players[0]!.ready, false);
});

test("no-choice equipment, movement and eruption progress without extra actions", () => {
	let s = withPhase("reroll");
	s.initOptions.autoProgress = true;
	s.initOptions.autoMovement = true;
	s.players.forEach((p) => {
		p.cards = [];
		p.bonus = 100;
	});
	s = applyMove(s, { action: "finishRerolls" }, 0);
	assert.equal(s.phase, "planning");
	assert.equal(s.round, 2);
	assert.equal(s.history.at(-1)!.move.action, "finishRerolls");
	assert(s.log.some((e) => e.type === "eruption"));
});

test("power bars only wait when they can improve success or stamina loss", () => {
	for (const bonus of [100, 1, -100]) {
		let s = withPhase("movement");
		s.initOptions.autoProgress = true;
		cell(s, "0,3").terrain = 16;
		s.players.forEach((p) => p.dice.forEach((d) => (d.face = 2)));
		s.players[0]!.bonus = bonus;
		s.players[1]!.powerBars = 2;
		s = applyMove(s, { action: "beginMovement" }, 0);
		assert.equal(s.players[1]!.powerBars, 2);
		if (bonus === 1) {
			assert.deepEqual(s.pendingHelpers, [1]);
			assert.equal(s.players[0]!.resolved, false);
		} else {
			assert.equal(s.players[0]!.resolved, true);
			assert.equal(s.pendingHelpers, undefined);
		}
	}
});

test("power bar choices keep only amounts that improve an outcome", () => {
	const s = withPhase("movement");
	cell(s, "0,3").terrain = 16;
	s.players.forEach((p) => p.dice.forEach((d) => (d.face = 2)));
	s.activeResolution = 0;
	s.pendingHelpers = [1];
	s.players[1]!.powerBars = 3;
	s.players[0]!.bonus = 4;
	assert.deepEqual(powerBarChoices(s, 1), [1]);
	s.players[0]!.bonus = 1;
	assert.deepEqual(powerBarChoices(s, 1), [2]);
	s.players[0]!.bonus = -2;
	assert.deepEqual(powerBarChoices(s, 1), [3]);
	s.players[0]!.bonus = 100;
	assert.deepEqual(powerBarChoices(s, 1), []);
	// Partial contributions remain meaningful when another Gatherer can complete them.
	s.players[0]!.bonus = -2;
	s.players[2]!.powerBars = 2;
	s.pendingHelpers = [1, 2];
	assert.deepEqual(powerBarChoices(s, 1), [1, 2, 3]);
});

test("playtest AI spends only enough bars to turn a failed comparison into success", () => {
	const s = withPhase("movement");
	cell(s, "0,3").terrain = 16;
	s.players.forEach((p) => p.dice.forEach((d) => (d.face = 2)));
	s.activeResolution = 0;
	s.pendingHelpers = [1];
	s.players[1]!.powerBars = 3;
	assert.equal(choosePowerBars(s, 1), 1);
	s.players[0]!.bonus = -1;
	assert.equal(choosePowerBars(s, 1), 2);
	s.players[0]!.bonus = -3;
	assert.equal(choosePowerBars(s, 1), 0);
	s.players[0]!.bonus = 1;
	assert.equal(choosePowerBars(s, 1), 0);
});

test("moveAI uses the public view, preserves its input and records a replayable action", async () => {
	const wrapper = await import("../wrapper.js");
	const s = prepared();
	const before = structuredClone(s);
	const next = wrapper.moveAI(s, 0);
	assert.deepEqual(s, before);
	assert.deepEqual(wrapper.moveAI(s, 0), next);
	assert.deepEqual(replay(next), next);
	const hidden = structuredClone(s);
	hidden.players[1]!.dice.forEach((d) => (d.face = d.face === 1 ? 6 : 1));
	const { chooseMove } = await import("../index.js");
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), chooseMove(stripSecret(hidden, 0), 0));
	const ready = applyMove(s, { action: "ready" }, 0);
	assert.throws(() => wrapper.moveAI(ready, 0), /No AI action/);
	assert.deepEqual(wrapper.currentPlayer(ready), [1, 2]);
});

test("AI leaves a threatened location even when staying has the best dice total", async () => {
	const { chooseMove } = await import("../index.js");
	const s = prepared();
	cell(s, "0,2").lava = true;
	s.players[1]!.cards = [];
	cell(s, "0,3").terrain = 16;
	s.players[1]!.dice.forEach((d) => (d.face = 6));
	const move = chooseMove(stripSecret(s, 1), 1);
	assert.equal(move.action, "plan");
	const route = move.path as string[];
	assert.notEqual(route.at(-1), s.players[1]!.position);
	assert(!threatened(s).includes(route.at(-1)!));
	assert.doesNotThrow(() => applyMove(s, move, 1));
});

test("destination paths prefer fewer eruption triggers, then fewer steps", () => {
	const s = prepared();
	s.players[0]!.position = "0,0";
	s.board = [
		[0, 0],
		[1, 0],
		[2, 0],
		[0, 1],
		[1, 1],
		[2, 1],
	].map(([x, y]) => ({
		id: `${x},${y}`,
		x: x!,
		y: y!,
		terrain: 16,
		lava: false,
		equipment: false,
		eruption: x === 1 && y === 0 ? 1 : 0,
	}));
	assert.deepEqual(paths(s, 0, 4)["2,0"], ["0,0", "0,1", "1,1", "2,1", "2,0"]);
	assert.deepEqual(paths(s, 0)["2,0"], ["0,0", "1,0", "2,0"]);
	cell(s, "1,0").eruption = 0;
	assert.deepEqual(paths(s, 0, 4)["2,0"], ["0,0", "1,0", "2,0"]);
	cell(s, "1,0").lava = true;
	assert.equal(paths(s, 0)["2,0"], undefined);
});

test("compact journey snapshots distinguish planned stays, failed comparisons and blocked routes", () => {
	for (const reason of ["planned-stay", "comparison", "blocked"] as const) {
		const s = withPhase("movement");
		cell(s, "0,3").terrain = 16;
		s.players.forEach((p) => p.dice.forEach((d) => (d.face = 2)));
		s.players[0]!.bonus = reason === "comparison" ? 0 : 100;
		if (reason === "blocked") {
			s.players[0]!.path = ["0,3", "1,3"];
			cell(s, "1,3").lava = true;
		}
		const next = applyMove(s, { action: "beginMovement" }, 0);
		const record = next.log
			.slice()
			.reverse()
			.find((e) => e.journey)?.journey;
		assert(record);
		assert.equal(record.reason, reason);
		assert.equal(record.moved, false);
		assert.equal(record.loss, reason === "planned-stay" ? 0 : 3);
		assert.equal(record.participants.length, 3);
		const snapshot = structuredClone(record);
		next.players[0]!.dice[0]!.face = 1;
		assert.deepEqual(record, snapshot);
		assert.deepEqual(
			stripSecret(next)
				.log.slice()
				.reverse()
				.find((e) => e.journey)?.journey,
			snapshot
		);
	}
});

test("AI rerolls weak matching dice but keeps strong matches without consulting hidden rolls", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase("reroll");
	const p = s.players[1]!;
	cell(s, p.path.at(-1)!).terrain = 4;
	p.rerolls = 1;
	p.dice.forEach((d) => (d.face = 1));
	const weak = p.dice.find((d) => d.type === 1)!;
	const strong = p.dice.find((d) => d.id !== weak.id)!;
	strong.face = 6;
	const choice = chooseMove(stripSecret(s, 1), 1);
	assert.equal(choice.action, "reroll");
	assert((choice.ids as string[]).includes(weak.id));
	assert(!(choice.ids as string[]).includes(strong.id));
	s.players[0]!.dice.forEach((d) => (d.face = 6));
	assert.deepEqual(chooseMove(stripSecret(s, 1), 1), choice);
	p.rerolls = 0;
	assert.equal(chooseMove(stripSecret(s, 1), 1).action, "finishRerolls");
});

test("AI weighs reroll opportunities before committing to a weak three-step route", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase("planning");
	s.players.forEach((p) => {
		p.position = "0,0";
		p.path = ["0,0"];
		p.dice.forEach((d) => (d.face = 1));
	});
	s.board = [0, 1, 2, 3, 4].map((x) => ({
		id: `${x},0`,
		x,
		y: 0,
		terrain: x === 4 ? 30 : 4,
		lava: false,
		equipment: false,
		eruption: 0,
	}));
	const choice = chooseMove(stripSecret(s, 1), 1);
	const path = choice.action === "plan" ? (choice.path as string[]) : s.players[1]!.path;
	assert(path.length < 4);
	assert(rerollAllowance(s, 1, path) > 0);
	s.players[0]!.dice.forEach((d) => (d.face = 6));
	assert.deepEqual(chooseMove(stripSecret(s, 1), 1), choice);
});

test("confirmed route journal preserves terrain, pickups and untriggered eruptions", () => {
	let s = withPhase("planning");
	s.players[1]!.position = "0,3";
	s.players[1]!.path = ["0,3"];
	s.players[2]!.position = "1,2";
	s.players[2]!.path = ["1,2"];
	s.players[0]!.path = ["0,3", "1,3"];
	cell(s, "1,3").eruption = 1;
	cell(s, "1,3").equipment = true;
	s.players[0]!.ready = true;
	s.players[1]!.ready = true;
	const expectedRerolls = rerollAllowance(s, 0);
	s = applyMove(s, { action: "ready" }, 2);
	const route = s.log.find((e) => e.route?.name === s.players[0]!.name)!.route!;
	assert.equal(route.rerolls, expectedRerolls);
	assert.deepEqual(route.cells.at(-1), { terrain: cell(s, "1,3").terrain, eruption: 1, equipment: true });
	cell(s, "1,3").eruption = 0;
	cell(s, "1,3").equipment = false;
	assert.equal(route.cells.at(-1)!.eruption, 1);
	assert.equal(route.cells.at(-1)!.equipment, true);
});

test("set-aside journal snapshots reveal only the chosen dice", () => {
	for (const kind of ["buddy", "machete", "knife"] as const) {
		let s = withPhase(kind === "buddy" ? "reroll" : "equipment");
		const ids = s.players[0]!.dice.slice(0, kind === "buddy" ? 1 : 2).map((d) => d.id);
		if (kind === "buddy") s = applyMove(s, { action: "buddy", ids }, 0);
		else {
			if (kind === "knife") s.players[1]!.cards = [{ id: "machete", used: 0, availableRound: 0 }];
			s = equip(s, 0, kind, { ids, ...(kind === "knife" ? { copy: "machete" } : {}) });
		}
		const revealed = s.log.find((e) => e.setAside)!.setAside!;
		assert.deepEqual(
			revealed.map((d) => d.id),
			ids
		);
		assert(revealed.every((d) => d.face > 0 && d.aside));
		const frozen = structuredClone(revealed);
		s.players[0]!.dice[0]!.face = 1;
		assert.deepEqual(revealed, frozen);
		const publicView = stripSecret(s, 1);
		assert.deepEqual(publicView.log.find((e) => e.setAside)!.setAside, frozen);
		assert(publicView.players[0]!.dice.filter((d) => !d.aside).every((d) => d.face === 0));
	}
});

test("AI estimates destination-specific distributions and conditions on revealed faces", async () => {
	const { contributionDistribution } = await import("../index.js");
	const die = { ...prepared().players[0]!.dice[0]!, type: 0, face: 0 };
	const pink = contributionDistribution([die], { colors: ["pink"] });
	const any = contributionDistribution([die], {});
	const mean = (p: number[]) => p.reduce((sum, v, i) => sum + v * i, 0);
	assert(Math.abs(mean(pink) - 7 / 6) < 1e-10);
	assert(Math.abs(mean(any) - 3.5) < 1e-10);
	assert.equal(contributionDistribution([{ ...die, face: 4 }], { colors: ["pink"] })[4], 1);
});

test("AI uses Flare for a weak result without reading hidden rolls, and conserves it when unbeatable", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase();
	s.players.forEach((p, i) => {
		p.position = ["0,3", "1,3", "1,2"][i]!;
	});
	for (const p of s.players) {
		p.path = [p.position];
		cell(s, p.position).terrain = 16;
		p.dice.forEach((d) => (d.face = 3));
	}
	s.players[0]!.cards = [{ id: "flare", used: 0, availableRound: 0 }];
	const move = chooseMove(stripSecret(s, 0), 0);
	assert.equal(move.id, "flare");
	assert.doesNotThrow(() => applyMove(s, move, 0));
	s.players[1]!.dice.forEach((d) => (d.face = 6));
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), move);
	s.players[0]!.bonus = 100;
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "ready");
});

test("Buddy and Machete remove conflicts without reducing their own matching total", async () => {
	const { chooseMove } = await import("../index.js");
	for (const ability of ["buddy", "machete"]) {
		const s = withPhase(ability === "buddy" ? "reroll" : "equipment");
		s.players.forEach((p, i) => {
			p.position = ["0,3", "1,3", "1,2"][i]!;
		});
		for (const p of s.players) {
			p.path = [p.position];
			cell(s, p.position).terrain = 8;
			p.cards = [];
		}
		const p = s.players[0]!;
		cell(s, p.position).terrain = 19;
		p.skill = "buddy";
		p.buddyUsed = false;
		p.rerolls = 0;
		p.dice.forEach((d) => (d.face = 3));
		p.dice[0]!.face = 6;
		if (ability === "machete") p.cards = [{ id: "machete", used: 0, availableRound: 0 }];
		const move = chooseMove(stripSecret(s, 0), 0);
		assert.equal(ability === "buddy" ? move.action : move.id, ability);
		assert.deepEqual(move.ids, [p.dice[0]!.id]);
		assert.doesNotThrow(() => applyMove(s, move, 0));
	}
});

test("AI flips useful dice only when the change does not strengthen teammates' opposition", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase();
	s.players.forEach((p, i) => {
		p.position = ["0,3", "1,3", "1,2"][i]!;
	});
	for (const p of s.players) {
		p.path = [p.position];
		cell(s, p.position).terrain = 19;
		p.cards = [];
	}
	const p = s.players[0]!;
	cell(s, p.position).terrain = 8;
	p.cards = [{ id: "tape", used: 0, availableRound: 0 }];
	p.dice.forEach((d) => (d.face = 1));
	assert.equal(chooseMove(stripSecret(s, 0), 0).id, "tape");
	cell(s, s.players[1]!.position).terrain = 16;
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "ready");
	p.injuries = ["arm"];
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "ready");
});

test("AI lending and optional reroll responses choose useful dice or decline", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase();
	s.players.forEach((p, i) => {
		p.position = ["0,3", "1,3", "1,2"][i]!;
	});
	s.players.forEach((p) => {
		p.path = [p.position];
		cell(s, p.position).terrain = 19;
	});
	cell(s, s.players[1]!.position).terrain = 8;
	s.players[0]!.dice.forEach((d) => (d.face = 3));
	s.players[0]!.dice[0]!.face = 6;
	s.pending = { kind: "lend", players: [0], receiver: 1, remaining: 1, required: false };
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), { action: "respond", ids: [s.players[0]!.dice[0]!.id] });
	s.players[0]!.dice[0]!.face = 3;
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "decline");
	s.pending = { kind: "reroll", players: [0], remaining: 2, required: false };
	s.players[0]!.dice.forEach((d) => (d.face = 5));
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "decline");
});

test("Wireless changes AI estimates only when the other player's dice become public", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase();
	s.players.forEach((p, i) => {
		p.position = ["0,3", "1,3", "1,2"][i]!;
		p.path = [p.position];
		cell(s, p.position).terrain = 16;
		p.dice.forEach((d) => (d.face = i === 0 ? 3 : 1));
	});
	s.players[0]!.cards = [{ id: "flare", used: 0, availableRound: 0 }];
	assert.equal(chooseMove(stripSecret(s, 0), 0).id, "flare");
	s.players[1]!.radio = true;
	s.players[2]!.radio = true;
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "ready");
});

test("AI has legal useful choices for every equipment card, including copied effects", async () => {
	const { chooseMove, EQUIPMENT } = await import("../index.js");
	for (const card of EQUIPMENT) {
		let used = false;
		for (let example = 0; example < 180 && !used; example++) {
			let s = withPhase((card.phases as readonly number[]).includes(4) ? "equipment" : "planning");
			s.players.forEach((p, i) => {
				p.position = ["0,3", "3,3", "3,2"][i]!;
				p.path = [p.position];
				p.radio = true;
				p.cards = [];
				cell(s, p.position).terrain = 4 + ((example * 7 + i * 11) % 24);
				p.dice.forEach((d, j) => (d.face = 1 + ((example * 3 + i * 2 + j * 5) % 6)));
			});
			s.players[0]!.radio = false;
			s.players[0]!.cards = [{ id: card.id, used: 0, availableRound: 0 }];
			if (card.id === "knife") s.players[1]!.cards = [{ id: "flare", used: 0, availableRound: 0 }];
			const view = stripSecret(s, 0),
				before = structuredClone(view);
			let move = chooseMove(view, 0);
			assert.deepEqual(view, before);
			if (move.action === "plan") {
				s = applyMove(s, move, 0);
				move = chooseMove(stripSecret(s, 0), 0);
			}
			if (move.action === "equipment" && move.id === card.id) {
				assert.doesNotThrow(() => applyMove(s, move, 0), card.id);
				used = true;
			}
		}
		assert(used, `No useful example for ${card.id}`);
	}
});

test("AI route selection reacts to Wireless reveals while hidden dice remain irrelevant", async () => {
	const { chooseMove } = await import("../index.js");
	let changed = false;
	for (let example = 0; example < 30 && !changed; example++) {
		const s = prepared();
		s.players.forEach((p) => (p.cards = []));
		s.players[0]!.dice.forEach((d, i) => (d.face = 1 + ((i + example) % 6)));
		s.players[1]!.dice.forEach((d) => (d.face = 1));
		const hidden = chooseMove(stripSecret(s, 0), 0);
		s.players[1]!.dice.forEach((d) => (d.face = 6));
		assert.deepEqual(chooseMove(stripSecret(s, 0), 0), hidden);
		s.players[1]!.radio = true;
		const high = chooseMove(stripSecret(s, 0), 0);
		s.players[1]!.dice.forEach((d) => (d.face = 1));
		const low = chooseMove(stripSecret(s, 0), 0);
		if (JSON.stringify(high) !== JSON.stringify(low)) {
			assert.doesNotThrow(() => applyMove(s, low, 0));
			changed = true;
		}
	}
	assert(changed, "Revealed contributions must influence route choice");
});

test("Water flask journal describes the recipient and each reroll without exposing private faces", () => {
	let s = withPhase();
	s.players[0]!.cards = [{ id: "water", used: 0, availableRound: 0 }];
	s = applyMove(s, { action: "equipment", id: "water", target: 0 }, 0);
	assert.match(s.log.at(-1)!.text, /gets up to 2 rerolls/);
	const ids = s.players[0]!.dice.slice(0, 2).map((d) => d.id);
	s = applyMove(s, { action: "respond", ids }, 0);
	assert.match(s.log.at(-1)!.text, /rerolled 2 dice with Water flask/);
	assert.equal(s.log.at(-1)!.dice, undefined);
	assert.equal(stripSecret(s, 1).log.at(-1)!.dice, undefined);
	s = applyMove(s, { action: "decline" }, 0);
	assert.match(s.log.at(-1)!.text, /skipped the remaining Water flask reroll/);
});

test("Rope and copied Rope log one movement entry and retain the animation", () => {
	for (const id of ["rope", "knife"] as const) {
		const s = withPhase("planning");
		s.players[0]!.cards = [{ id, used: 0, availableRound: 0 }];
		s.players[1]!.cards = [{ id: "rope", used: 0, availableRound: 0 }];
		Object.assign(cell(s, "1,3"), { terrain: 5, lava: false, eruption: 0, equipment: false });
		const next = applyMove(s, { action: "equipment", id, copy: "rope", tiles: ["1,3"] }, 0);
		const entries = next.log.slice(s.log.length);
		assert.equal(entries.length, 1);
		assert.equal(
			entries[0]!.text,
			`${s.players[0]!.name} moved to Sunlit shrine using ${id === "knife" ? "Pocketknife as Rope" : "Rope"}.`
		);
		assert.deepEqual(entries[0]!.animation, { kind: "move", seat: 0, path: [s.players[0]!.position, "1,3"] });
	}
});

test("all seven official layouts preserve terrain decks, markers, starts and connected paths", () => {
	const starts = [
		["0,3", "1,2"],
		["1,4", "1,3"],
		["0,1", "0,2"],
		["0,5", "1,5"],
		["5,2", "6,3"],
		["1,1", "2,1"],
		["5,6", "5,5"],
	];
	for (let scenario = 1; scenario <= 7; scenario++)
		for (const players of [2, 3, 4]) {
			const s = initGame(players, { scenario }, "scenario-layout");
			assert.equal(s.scenario, scenario);
			assert.equal(s.board.filter((c) => terrain(c.terrain).kind === "village").length, players === 4 ? 6 : 5);
			assert.equal(s.board.filter((c) => c.lava).length, 1);
			assert.equal(s.board.filter((c) => c.eruption).length, 2);
			assert.equal(s.board.filter((c) => c.equipment).length, 7);
			assert.equal(new Set(s.board.map((c) => c.terrain)).size, s.board.length);
			assert(s.board.every((c) => terrain(c.terrain)));
			assert.equal(s.players[0]!.position, starts[scenario - 1]![0]);
			if (players === 4) assert.equal(s.players[2]!.position, starts[scenario - 1]![1]);
			const seen = new Set([s.board[0]!.id]);
			for (let i = 0; i < s.board.length; i++)
				for (const c of s.board) {
					if (s.board.some((b) => seen.has(b.id) && Math.abs(b.x - c.x) + Math.abs(b.y - c.y) === 1)) seen.add(c.id);
				}
			assert.equal(seen.size, s.board.length, `Connected scenario ${scenario}`);
			assert.deepEqual(replay(s), s);
		}
	for (const scenario of [0, 8, 1.5, "invalid"]) assert.throws(() => initGame(3, { scenario }));
});

test("trapped neighbors can all confirm staying and still lose to the eruption", () => {
	let s = prepared();
	const position = s.players[0]!.position;
	s.board.forEach((c) => {
		c.lava = c.id !== position;
	});
	s.players.forEach((p) => {
		p.position = position;
		p.path = [position];
		p.ready = false;
	});
	for (let seat = 0; seat < 3; seat++) s = applyMove(s, { action: "ready" }, seat);
	assert.equal(s.phase, "reroll");
	s.phase = "eruption";
	s = applyMove(s, { action: "erupt" }, 0);
	assert.equal(s.outcome, "lost");
});

test("a shared destination remains forbidden when another route is available", () => {
	let s = prepared();
	s.players[0]!.ready = true;
	assert.throws(() => applyMove(s, { action: "ready" }, 1), /different destinations/);
});

test("village bots leave the only reachable entrance for an approaching neighbor", async () => {
	const { chooseMove } = await import("../index.js");
	const s = prepared();
	s.players.forEach((p) => {
		p.cards = [];
		p.ready = false;
	});
	for (const c of s.board) if (terrain(c.terrain).kind === "village") c.terrain = 28;
	const positions = ["4,2", "3,4", "6,0"];
	s.players.forEach((p, i) => {
		p.position = positions[i]!;
		p.path = [p.position];
	});
	s.players[0]!.dice.forEach((d) => {
		d.face = 1;
	});
	const entrances = Object.keys(paths(s, 1)).filter((id) => terrain(cell(s, id).terrain).kind === "village");
	assert.deepEqual(entrances, ["4,2"]);
	const move = chooseMove(stripSecret(s, 0), 0);
	assert.equal(move.action, "plan");
	const route = move.path as string[];
	assert.notEqual(route.at(-1), "4,2");
	assert.equal(terrain(cell(s, route.at(-1)!).terrain).kind, "village");
	assert(!route.slice(1).some((id) => cell(s, id).eruption || cell(s, id).lava));
	const noArrival = structuredClone(s);
	noArrival.players[1]!.position = "5,0";
	noArrival.players[1]!.path = ["5,0"];
	assert.equal(chooseMove(stripSecret(noArrival, 0), 0).action, "ready");
	s.players[1]!.dice.forEach((d) => {
		d.face = 6;
	});
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), move, "Hidden teammate dice must not affect entrance sharing");
});

test("AI follows the connected trail around scenario 7's gap instead of camping near the village", async () => {
	const { chooseMove } = await import("../index.js");
	const s = initGame(3, { scenario: 7 }, "detour-regression");
	s.phase = "planning";
	for (const [i, p] of s.players.entries()) {
		p.position = ["5,5", "5,4", "5,3"][i]!;
		p.path = [p.position];
		p.ready = false;
		p.cards = [];
		p.dice.forEach((d) => (d.face = 1));
	}
	// Equal requirements isolate route geometry from lucky dice or equipment.
	for (const c of s.board) if (terrain(c.terrain).kind === "land") c.terrain = 16;
	for (const seat of [1, 2]) {
		const choice = chooseMove(stripSecret(s, seat), seat);
		assert.equal(choice.action, "plan");
		const route = choice.path as string[];
		assert(route.length > 1);
		assert(cell(s, route.at(-1)!).y <= 2, "advance toward the bridge around the gap");
		const previous = structuredClone(choice);
		s.players[0]!.dice.forEach((d) => (d.face = 6));
		assert.deepEqual(chooseMove(stripSecret(s, seat), seat), previous);
	}
});

test("AI uses Rope to advance around a map gap even when coordinate distance increases", async () => {
	const { chooseMove } = await import("../index.js");
	const s = initGame(3, { scenario: 7 }, "rope-detour");
	s.phase = "equipment";
	for (const [i, p] of s.players.entries()) {
		p.position = ["5,4", "6,5", "6,3"][i]!;
		p.path = [p.position];
		p.ready = false;
		p.cards = [];
	}
	s.players[0]!.cards = [{ id: "rope", used: 0, availableRound: 0 }];
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), { action: "equipment", id: "rope", tiles: ["5,3"] });
});

test("AI rerolls for a prospective Binoculars destination before spending the swap", async () => {
	const { chooseMove } = await import("../index.js");
	let s = initGame(3, { scenario: 7 }, "swap-regression-0");
	for (let i = 0; i < 3; i++) {
		const p = s.players[i]!;
		if (!p.setupDone)
			s = applyMove(
				s,
				{
					action: "setup",
					keep: p.cards.slice(0, p.skill === "manager" ? 2 : 1).map((c) => c.id),
					drop: p.dice.at(-1)?.id,
				},
				i
			);
	}
	s.phase = "planning";
	s.players.forEach((p) => {
		p.cards = [];
		p.ready = false;
	});
	s.players[2]!.cards = [{ id: "binoculars", used: 0, availableRound: 0 }];
	const swap = chooseMove(stripSecret(s, 2), 2);
	assert.equal(swap.id, "binoculars");
	const hypothetical = structuredClone(s);
	const [a, b] = (swap.tiles as string[]).map((id) => cell(hypothetical, id));
	[a!.terrain, b!.terrain] = [b!.terrain, a!.terrain];
	hypothetical.players[2]!.cards = [{ id: "torch", used: 0, availableRound: 0 }];
	const route = chooseMove(stripSecret(hypothetical, 2), 2);
	assert.equal(route.action, "plan");
	assert.equal((route.path as string[]).at(-1), a!.id);
	hypothetical.players[2]!.path = route.path as string[];
	const expectedRoll = chooseMove(stripSecret(hypothetical, 2), 2);
	assert.equal(expectedRoll.id, "torch");
	s.players[2]!.cards.push({ id: "torch", used: 0, availableRound: 0 });
	const before = structuredClone(s);
	assert.deepEqual(chooseMove(stripSecret(s, 2), 2), expectedRoll);
	assert.deepEqual(s, before);
	const rolled = applyMove(s, expectedRoll, 2);
	assert.deepEqual(rolled.board, before.board, "the proposed swap is not committed before rolling");
	assert(rolled.players[2]!.cards.some((c) => c.id === "binoculars"));
	s.players[0]!.dice.forEach((d) => (d.face = 6));
	assert.deepEqual(chooseMove(stripSecret(s, 2), 2), expectedRoll);
});

test("skip injury choices when a resolved explorer is certain to die in the eruption", () => {
	for (const doomed of [true, false]) {
		let s = withPhase("movement");
		s.initOptions.autoProgress = true;
		s.activeResolution = 0;
		s.players.forEach((p) => {
			p.dice.forEach((d) => (d.face = 2));
			p.path = [p.position];
			p.powerBars = 0;
		});
		cell(s, s.players[0]!.position).terrain = 16;
		s.players[0]!.stamina = 4;
		for (const c of s.board) c.lava = false;
		cell(s, "0,2").lava = doomed;
		s = applyMove(s, { action: "resolve" }, 0);
		if (doomed) {
			assert.equal(s.outcome, "lost");
			assert.match(s.reason!, /lava/);
			assert(s.players.every((p) => p.pendingInjuries === 0));
			assert(s.log.some((e) => e.animation?.kind === "eruption"));
			assert.deepEqual(activePlayers(s), []);
		} else {
			assert.equal(s.outcome, null);
			assert.equal(s.players[0]!.pendingInjuries, 1);
			assert.deepEqual(activePlayers(s), [0]);
		}
	}
});

test("safe village residents sacrifice strong dice for escaping neighbors without risking exhaustion", async () => {
	const { chooseMove } = await import("../index.js");
	const s = withPhase("reroll");
	s.board.forEach((c) => (c.lava = false));
	s.players.forEach((p, i) => {
		p.position = ["4,2", "2,2", "3,3"][i]!;
		p.path = [p.position];
		p.cards = [];
		p.dice.forEach((d) => (d.face = 6));
		cell(s, p.position).terrain = i === 0 ? 33 : 16;
	});
	const p = s.players[0]!;
	p.skill = "gatherer";
	p.stamina = 0;
	p.rerolls = 2;
	const roll = chooseMove(stripSecret(s, 0), 0);
	assert.equal(roll.action, "reroll");
	assert.equal((roll.ids as string[]).length, p.dice.length);
	s.players[1]!.dice.forEach((d) => (d.face = 1));
	assert.deepEqual(chooseMove(stripSecret(s, 0), 0), roll);
	p.stamina = 25 - (s.difficulty + 2);
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "finishRerolls");
	p.stamina = 0;
	cell(s, "4,1").lava = true;
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "finishRerolls");
	cell(s, "4,1").lava = false;
	p.skill = "buddy";
	assert.equal(chooseMove(stripSecret(s, 0), 0).action, "buddy");
	s.phase = "equipment";
	p.cards = [{ id: "machete", used: 0, availableRound: 0 }];
	assert.equal(chooseMove(stripSecret(s, 0), 0).id, "machete");
});

test("random scenario is seeded, covers all seven layouts and replays exactly", () => {
	const seen = new Set<number>();
	for (let i = 0; i < 50; i++) {
		const s = initGame(3, { scenario: "random" }, `random-scenario-${i}`);
		assert(s.scenario! >= 1 && s.scenario! <= 7);
		seen.add(s.scenario!);
		assert.deepEqual(initGame(3, { scenario: "random" }, s.seed), s);
		assert.deepEqual(replay(s), s);
	}
	assert.equal(seen.size, 7);
});

test("new games assign distinct seeded random skills; legacy saves keep their roster", () => {
	const rosters = new Set<string>();
	for (let i = 0; i < 20; i++) {
		const s = createGame(4, {}, `skill-random-${i}`);
		assert.equal(s.initOptions.skillAssignment, "random");
		assert.equal(new Set(s.players.map((p) => p.skill)).size, 4);
		assert.deepEqual(replay(s), s);
		rosters.add(s.players.map((p) => p.skill).join());
	}
	assert(rosters.size > 1);
	const legacy = initGame();
	delete legacy.initOptions.skillAssignment;
	assert.deepEqual(replay(legacy), legacy);
});

test("players choose distinct skills before equipment is dealt, with exact replay", () => {
	let s = createGame(3, { skillAssignment: "choose" }, "skill-draft");
	assert(s.players.every((p) => p.cards.length === 0));
	assert.deepEqual(activePlayers(s), [0]);
	assert.throws(() => applyMove(s, { action: "setup", keep: [] }, 0));
	assert.throws(() => applyMove(s, { action: "chooseSkill", skill: "manager" }, 1));
	s = applyMove(s, { action: "chooseSkill", skill: "manager" }, 0);
	const before = structuredClone(s);
	assert.throws(() => applyMove(s, { action: "chooseSkill", skill: "manager" }, 1));
	assert.deepEqual(s, before);
	s = applyMove(s, { action: "chooseSkill", skill: "scout" }, 1);
	s = applyMove(s, { action: "chooseSkill", skill: "gatherer" }, 2);
	assert.equal(s.skillChoices, undefined);
	assert.deepEqual(
		s.players.map((p) => p.cards.length),
		[4, 2, 1]
	);
	assert.deepEqual(activePlayers(s), [0, 1]);
	assert.deepEqual(replay(s), s);
});

test("village residents clear entrances before a neighbor is within one move", async () => {
	const { chooseMove } = await import("../index.js");
	const s = initGame(3, {}, "future-entrance");
	s.phase = "planning";
	s.board.forEach((c) => {
		c.lava = false;
		c.eruption = 0;
		if (terrain(c.terrain).kind === "village") c.terrain = 28;
	});
	s.players.forEach((p, i) => {
		p.cards = [];
		p.ready = false;
		p.position = ["4,2", "1,5", "6,0"][i]!;
		p.path = [p.position];
		p.dice.forEach((d) => (d.face = 1));
	});
	assert(!Object.keys(paths(s, 1)).some((id) => terrain(cell(s, id).terrain).kind === "village"));
	for (const ready of [false, true]) {
		s.players[1]!.ready = ready;
		const move = chooseMove(stripSecret(s, 0), 0);
		assert.equal(move.action, "plan");
		assert.notEqual((move.path as string[]).at(-1), "4,2");
		assert.equal(terrain(cell(s, (move.path as string[]).at(-1)!).terrain).kind, "village");
		s.players[1]!.dice.forEach((d) => (d.face = 6));
		assert.deepEqual(chooseMove(stripSecret(s, 0), 0), move);
	}
});

test("AI crosses a choke point before lava disconnects the otherwise safe side", async () => {
	const { chooseMove } = await import("../index.js");
	const s = initGame(3, {}, "cutoff-regression");
	s.phase = "planning";
	s.board = Array.from({ length: 6 }, (_, x) => ({
		id: `${x},0`,
		x,
		y: 0,
		terrain: x === 5 ? 33 : x === 3 ? 15 : 16,
		lava: false,
		equipment: false,
		eruption: 0,
	}));
	s.board.push({ id: "2,1", x: 2, y: 1, terrain: 1, lava: true, equipment: false, eruption: 0 });
	s.players.forEach((p, i) => {
		p.cards = [];
		p.ready = false;
		p.position = i === 0 ? "0,0" : "5,0";
		p.path = [p.position];
		p.dice.forEach((d) => (d.face = 6));
	});
	assert(!threatened(s).includes("1,0"), "the tempting tile itself is not threatened");
	assert(threatened(s).includes("2,0"), "the connecting bridge will burn");
	const move = chooseMove(stripSecret(s, 0), 0);
	assert.deepEqual(move, { action: "plan", path: ["0,0", "1,0", "2,0", "3,0"] });
	cell(s, "3,0").eruption = 1;
	const extraWave = chooseMove(stripSecret(s, 0), 0);
	assert.notEqual(
		(extraWave.path as string[] | undefined)?.at(-1),
		"3,0",
		"the extra wave would consume that destination"
	);
});
