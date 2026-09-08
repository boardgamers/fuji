import {
	comparison,
	powerBarChoices,
	applyMove,
	stripSecret,
	activePlayers,
	neighbors,
	paths,
	cell,
	total,
	activeDice,
	face,
} from "./game.js";
import { terrain, SKILLS, matches } from "./data.js";
import type { State, View, Move } from "./types.js";

// Conservative playtest policy: spend the minimum that changes a failed
// comparison into a success, rather than saving every bar indefinitely.
export function choosePowerBars(state: State | View, helper: number): number {
	if (state.activeResolution === null) return 0;
	const result = comparison(state, state.activeResolution);
	if (result.success) return 0;
	const needed = 1 - result.margin;
	return powerBarChoices(state, helper).includes(needed) ? needed : 0;
}

export function chooseMove(game: View, seat: number): Move {
	const p = game.players[seat]!;
	if (game.pending) {
		if (game.pending.kind === "lend") return { action: "decline" };
		return { action: "respond", ids: [activeDice(p)[0]!.id] };
	}
	if (p.pendingInjuries) {
		const injury = ["arm", "eye", "amnesia", "leg"].find((i) => !p.injuries.includes(i as never))!;
		return { action: "injury", injury, die: p.dice.find((d) => d.owner === seat && !d.remove)?.id };
	}
	if (game.phase === "setup")
		return { action: "setup", keep: p.cards.slice(0, SKILLS[p.skill].keep).map((c) => c.id), drop: p.dice.at(-1)?.id };
	if (game.phase === "planning") {
		const choices = Object.values(paths(game, seat)).filter(
			(path) =>
				!neighbors(game, seat).some((i) => game.players[i]!.ready && game.players[i]!.path.at(-1) === path.at(-1))
		);
		const score = (path: string[]) => {
			const c = cell(game, path.at(-1)!);
			const closestVillage = Math.min(
				...game.board
					.filter((c) => terrain(c.terrain).kind === "village")
					.map((v) => Math.abs(c.x - v.x) + Math.abs(c.y - v.y))
			);
			return (
				total(p, c.terrain) * 0.65 -
				closestVillage * 2 +
				(terrain(c.terrain).kind === "village" ? 8 : 0) +
				(c.equipment ? 1 : 0) -
				(c.eruption ? 2 : 0)
			);
		};
		choices.sort((a, b) => score(b) - score(a));
		const best = choices[0];
		if (!best) throw Error("No available destination.");
		if (best.at(-1) !== p.path.at(-1)) return { action: "plan", path: best };
		return { action: "ready" };
	}
	if (game.phase === "reroll") {
		const r = terrain(cell(game, p.path.at(-1)!).terrain).requirement;
		const ids = activeDice(p)
			.filter((d) => !matches(face(d), r))
			.map((d) => d.id);
		return p.rerolls && ids.length ? { action: "reroll", ids } : { action: "finishRerolls" };
	}
	if (game.phase === "equipment") return { action: "ready" };
	if (game.phase === "movement") {
		if (game.pendingHelpers?.includes(seat)) return { action: "help", count: choosePowerBars(game, seat) };
		if (game.activeResolution === null) return { action: "beginMovement" };
		if (game.activeResolution === seat) return { action: "resolve" };
		return { action: "bar" };
	}
	return { action: "erupt" };
}

export function moveAI(state: State, seat: number): State {
	if (
		!activePlayers(state).includes(seat) ||
		(["planning", "equipment"].includes(state.phase) && state.players[seat]!.ready)
	)
		throw Error("No AI action is available for this player.");
	return applyMove(state, chooseMove(stripSecret(state, seat), seat), seat);
}
