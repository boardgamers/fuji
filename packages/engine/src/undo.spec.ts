import test from "node:test";
import assert from "node:assert/strict";
import * as wrapper from "../wrapper.js";
import { activePlayers, applyMove, initGame, moveAI, paths, replay, type State } from "../index.js";

// BGS undo against bots: the game-server records the log length before each saved move of the
// only human, then calls replay(data, { to }) and requires logLength(result) === to. Like BGS,
// these games name the seats after init, deliver queued chat after each move and persist JSON.
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const games = new Map<string, ReturnType<typeof playBotGame>>();
const botGame = (players: number, seed: string) => {
	if (!games.has(seed)) games.set(seed, playBotGame(players, seed));
	return games.get(seed)!;
};
async function playBotGame(players: number, seed: string, human = 0) {
	let data: State = await wrapper.init(players, [], {}, seed);
	for (let seat = 0; seat < players; seat++) data = wrapper.setPlayerMetaData(data, seat, { name: `Explorer ${seat}` });
	const undoPoints: { to: number; saved: State }[] = [];
	for (let moves = 0; !wrapper.ended(data) && moves < 400; moves++) {
		const seats = [wrapper.currentPlayer(data)].flat();
		// Bots sometimes act first in simultaneous phases.
		const seat = seats.includes(human) && moves % 3 !== 1 ? human : (seats.find((i) => i !== human) ?? human);
		if (seat === human) undoPoints.push({ to: wrapper.logLength(data), saved: json(data) });
		data = wrapper.messages(wrapper.moveAI(data, seat)).data;
	}
	return { data, undoPoints };
}
/** Choices recorded since the journal reached that length (names are carried over anyway). */
function unannouncedChoices(saved: State, to: number) {
	const since = saved.history.slice(replay(saved, undefined, to).history.length);
	return !!saved.planningSnapshot || since.some((entry) => entry.move.action !== "$name");
}
function assertReopened(undone: State, saved: State, seats: number[]) {
	assert.equal(undone.phase, saved.phase);
	assert.equal(undone.round, saved.round);
	assert.deepEqual(
		undone.players.map((p) => [p.name, p.position]),
		saved.players.map((p) => [p.name, p.position])
	);
	for (const seat of seats) assert(activePlayers(undone).includes(seat), `seat ${seat} chooses again`);
	assert.equal(wrapper.isLiveUpdate(undone), false);
	let next = undone;
	for (let i = 0; i < 80 && next.phase === saved.phase && next.round === saved.round && !wrapper.ended(next); i++)
		next = wrapper.moveAI(next, [wrapper.currentPlayer(next)].flat()[0]!);
	assert(next.phase !== saved.phase || next.round !== saved.round || wrapper.ended(next), "the phase can finish");
}

test("undo against bots returns to every recorded log position", async () => {
	let exact = 0;
	let reopened = 0;
	for (const [players, seed] of [
		[2, "undo-a"],
		[3, "undo-b"],
		[4, "undo-c"],
	] as const) {
		const { data, undoPoints } = await botGame(players, seed);
		assert(wrapper.ended(data));
		for (const { to, saved } of undoPoints) {
			const undone = json(wrapper.replay(data, { to }));
			assert.equal(wrapper.logLength(undone), to);
			// A later batch replay of the saved result must not diverge.
			const { chatMessages: _, ...again } = replay(undone);
			assert.deepEqual(json(again), undone);
			if (!unannouncedChoices(saved, to)) {
				assert.deepEqual(undone, saved);
				exact++;
			} else {
				// Live route and readiness edits add no journal entry: undo reopens that phase's choices.
				assertReopened(undone, saved, [0]);
				reopened++;
			}
		}
	}
	assert(exact > 0 && reopened > 0, "both kinds of positions are covered");
});

test("undoing the last preparation choice reopens unannounced bot preparations", async () => {
	// Seats 2 and 3 choose equipment; the bot at seat 2 packs first and adds no journal entry.
	let data: State = await wrapper.init(4, [], { skillAssignment: "fixed" }, "undo-setup");
	for (let seat = 0; seat < 4; seat++) data = wrapper.setPlayerMetaData(data, seat, { name: `Explorer ${seat}` });
	assert.deepEqual(activePlayers(data), [2, 3]);
	const to = wrapper.logLength(data);
	data = wrapper.moveAI(data, 2);
	assert.equal(wrapper.logLength(data), to);
	const saved = json(data);
	data = wrapper.moveAI(data, 3);
	assert.notEqual(data.phase, "setup");
	const undone = json(wrapper.replay(data, { to }));
	assert.equal(wrapper.logLength(undone), to);
	assert(unannouncedChoices(saved, to));
	assertReopened(undone, saved, [2, 3]);
});

test("undo keeps later names and drops without queuing chat announcements again", async () => {
	const { undoPoints } = await botGame(3, "undo-b");
	const { saved } = undoPoints.at(-1)!;
	const { to } = undoPoints.at(-2)!;
	assert((replay(saved, undefined, to).chatMessages ?? []).length > 0, "replayed moves announced equipment");
	const renamed = wrapper.setPlayerMetaData(saved, 1, { name: "Renamed" });
	const undone = wrapper.replay(renamed, { to });
	assert.equal(undone.players[1]!.name, "Renamed");
	assert.equal(replay(undone).players[1]!.name, "Renamed");
	assert.equal(undone.chatMessages, undefined);
	assert.deepEqual(wrapper.messages(undone).messages, []);
	const dropped = wrapper.replay(wrapper.dropPlayer(renamed, 2), { to });
	assert.equal(dropped.outcome, "lost");
	assert.equal(dropped.reason, "Explorer 2 left the expedition.");
});

test("replay without a position is unchanged and invalid positions are refused", () => {
	let s = initGame(3, { skillAssignment: "fixed" }, "undo-full");
	while (s.phase === "setup") s = moveAI(s, activePlayers(s)[0]!);
	s = applyMove(s, { action: "plan", path: Object.values(paths(s, 0)).at(-1)! }, 0);
	assert.equal(wrapper.isLiveUpdate(s), true);
	assert.deepEqual(wrapper.replay(s), replay(s));
	assert.deepEqual(wrapper.replay(s), s);
	for (const to of [-1, 0.5, s.log.length + 1])
		assert.throws(() => wrapper.replay(s, { to }), /Invalid history position/);
});
