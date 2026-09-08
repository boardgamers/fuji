import {
	initGame,
	applyMove,
	activePlayers,
	paths,
	total,
	terrain,
	cell,
	SKILLS,
	activeDice,
	matches,
	face,
	replay,
} from "../packages/engine/dist/index.js";
import assert from "node:assert/strict";
function choose(s, seat) {
	const p = s.players[seat];
	if (s.pending)
		return s.pending.kind === "lend" ? { action: "decline" } : { action: "respond", ids: [activeDice(p)[0].id] };
	if (p.pendingInjuries) {
		const injury = ["arm", "eye", "amnesia", "leg"].find((i) => !p.injuries.includes(i));
		return { action: "injury", injury, die: p.dice.find((d) => d.owner === seat)?.id };
	}
	switch (s.phase) {
		case "setup":
			return { action: "setup", keep: p.cards.slice(0, SKILLS[p.skill].keep).map((c) => c.id), drop: p.dice.at(-1).id };
		case "planning": {
			const choices = Object.values(paths(s, seat)).filter(
				(path) => !s.players.some((q, i) => i !== seat && q.ready && q.path.at(-1) === path.at(-1))
			);
			const score = (path) => {
				const c = cell(s, path.at(-1));
				const dist = Math.min(
					...s.board
						.filter((c) => terrain(c.terrain).kind === "village")
						.map((v) => Math.abs(c.x - v.x) + Math.abs(c.y - v.y))
				);
				return total(p, c.terrain) * 0.65 - dist * 2;
			};
			choices.sort((a, b) => score(b) - score(a));
			const best = choices[0];
			if (!best) throw Error("No path");
			return best.at(-1) !== p.path.at(-1) ? { action: "plan", path: best } : { action: "ready" };
		}
		case "reroll": {
			const ids = activeDice(p)
				.filter((d) => !matches(face(d), terrain(cell(s, p.path.at(-1)).terrain).requirement))
				.map((d) => d.id);
			return p.rerolls && ids.length ? { action: "reroll", ids } : { action: "finishRerolls" };
		}
		case "equipment":
			return { action: "ready" };
		case "movement":
			if (s.pendingHelpers?.includes(seat)) return { action: "help", count: 0 };
			return s.activeResolution === null
				? { action: "beginMovement" }
				: s.activeResolution === seat
					? { action: "resolve" }
					: { action: "bar" };
		case "eruption":
			return { action: "erupt" };
		default:
			throw Error("Unexpected phase");
	}
}
let moves = 0,
	wins = 0;
for (let players = 2; players <= 4; players++)
	for (let seed = 0; seed < 50; seed++) {
		let s = initGame(players, { difficulty: 1 + (seed % 4) }, `simulation-${seed}`);
		let steps = 0;
		while (!s.outcome && steps < 1000) {
			const active = activePlayers(s).filter(
				(i) => !["planning", "equipment"].includes(s.phase) || !s.players[i].ready
			);
			assert(active.length, "Active game must offer an action");
			const seat = active[0];
			s = applyMove(s, choose(s, seat), seat);
			assert.equal(
				new Set(s.players.flatMap((p) => p.dice.map((d) => d.id))).size,
				s.players.reduce((n, p) => n + p.dice.length, 0)
			);
			assert(s.players.every((p) => p.stamina >= 0 && p.stamina <= 25));
			steps++;
		}
		assert(s.outcome, `Deadlock: ${players}/${seed}`);
		assert.deepEqual(replay(s), s);
		moves += steps;
		if (s.outcome === "won") wins++;
	}
console.log(`150 complete expeditions; ${moves} moves; ${wins} wins; no deadlocks; exact replays.`);
