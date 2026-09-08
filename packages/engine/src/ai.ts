import {
	comparison,
	powerBarChoices,
	applyMove,
	stripSecret,
	activePlayers,
	neighbors,
	paths,
	cell,
	rerollAllowance,
	activeDice,
	face,
	threatened,
} from "./game.js";
import { terrain, SKILLS, matches, DICE, type Requirement } from "./data.js";
import type { State, View, Move } from "./types.js";

// Expected contribution after rolling, with the option to keep a result or
// try again. This uses the published die faces, never a teammate's hidden roll.
function rerollValue(type: number, requirement: Requirement, attempts: number): number {
	let value = 0;
	for (let i = 0; i < attempts; i++) {
		const continuation = value;
		value =
			DICE[type]!.reduce((sum, color, index) => {
				const contribution = matches({ color, value: index + 1 }, requirement) ? index + 1 : 0;
				return sum + Math.max(contribution, continuation);
			}, 0) / 6;
	}
	return value;
}

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
		const danger = new Set(threatened(game));
		const score = (path: string[]) => {
			const c = cell(game, path.at(-1)!);
			const closestVillage = Math.min(
				...game.board
					.filter((c) => terrain(c.terrain).kind === "village")
					.map((v) => Math.abs(c.x - v.x) + Math.abs(c.y - v.y))
			);
			const lavaDistance = Math.min(
				...game.board.filter((tile) => tile.lava).map((tile) => Math.abs(c.x - tile.x) + Math.abs(c.y - tile.y))
			);
			const requirement = terrain(c.terrain).requirement;
			const attempts = rerollAllowance(game, seat, path);
			const expected = activeDice(p).reduce(
				(sum, d) =>
					sum + Math.max(matches(face(d), requirement) ? d.face : 0, rerollValue(d.type, requirement, attempts)),
				p.bonus
			);
			const opposition = neighbors(game, seat).map((i) =>
				activeDice(game.players[i]!).reduce(
					(sum, d) =>
						sum + (d.face ? (matches(face(d), requirement) ? d.face : 0) : rerollValue(d.type, requirement, 1)),
					0
				)
			);
			if (game.players.length === 2)
				opposition.push(
					game.ghost.reduce(
						(sum, d) =>
							sum + (d.face ? (matches(face(d), requirement) ? d.face : 0) : rerollValue(d.type, requirement, 1)),
						0
					)
				);
			const expectedLead = expected - Math.max(...opposition);
			return (
				(danger.has(c.id) ? -1000 : 0) -
				12 / Math.max(1, lavaDistance) +
				expectedLead * 1 -
				closestVillage * 4 +
				(terrain(c.terrain).kind === "village" ? 8 : 0) +
				(c.equipment ? 1 : 0) -
				path.slice(1).reduce((cost, id) => cost + cell(game, id).eruption * 4, 0)
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
			.filter((d) => (matches(face(d), r) ? d.face : 0) < rerollValue(d.type, r, p.rerolls))
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
