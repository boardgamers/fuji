import {
	comparison,
	powerBarChoices,
	applyMove,
	stripSecret,
	activePlayers,
	neighbors,
	paths,
	mustStay,
	cell,
	rerollAllowance,
	activeDice,
	face,
	threatened,
	hasSkill,
	walkable,
} from "./game.js";
import { terrain, SKILLS, matches, DICE, EQUIPMENT, type Requirement, type EquipmentId } from "./data.js";
import type { State, View, Move, Die } from "./types.js";

export interface AiPolicy {
	equipment: boolean;
	lead: number;
	progress: number;
	success: number;
	stamina: number;
	teamwork: number;
	cost: number;
}
export const DEFAULT_AI_POLICY: AiPolicy = {
	equipment: true,
	lead: 1,
	progress: 4,
	success: 18,
	stamina: 1,
	teamwork: 0.4,
	cost: 0.8,
};
const ruleAt = (game: View, seat: number) =>
	terrain(cell(game, game.players[seat]!.path.at(-1) ?? game.players[seat]!.position).terrain).requirement;
const valueOf = (d: Die, r: Requirement) => (matches(face(d), r) ? d.face : 0);
const urgency = (game: View, seat: number) => (threatened(game).includes(game.players[seat]!.position) ? 3 : 1);

// Convolve independent fair rolls; revealed faces are point masses. This is a
// prior, not access to private rolls or a model of another player's strategy.
export function contributionDistribution(dice: Die[], rule: Requirement): number[] {
	let distribution = [1];
	for (const die of dice) {
		const next = Array<number>(distribution.length + 6).fill(0);
		const faces = die.face ? [die.face] : [1, 2, 3, 4, 5, 6];
		for (const f of faces) {
			const score = valueOf({ ...die, face: f }, rule);
			distribution.forEach((probability, total) => {
				next[total + score]! += probability / faces.length;
			});
		}
		distribution = next;
	}
	return distribution;
}
function rollGain(game: View, seat: number, die: Die, attempts = 1): number {
	const own = ruleAt(game, seat);
	const gain = rerollValue(die.type, own, attempts) - valueOf(die, own);
	const harm = neighbors(game, seat).reduce((sum, other) => {
		const rule = ruleAt(game, other);
		return sum + Math.max(0, rerollValue(die.type, rule, 1) - valueOf(die, rule)) * urgency(game, other);
	}, 0);
	return gain - 0.2 * harm;
}
function lendingChoice(game: View, donor: number, receiver: number): Die | undefined {
	return (
		activeDice(game.players[donor]!)
			.filter((d) => valueOf(d, ruleAt(game, donor)) === 0)
			.filter((d) => valueOf(d, ruleAt(game, receiver)) > 0)
			// A loan must not worsen a third player's comparison either.
			.filter((d) =>
				neighbors(game, receiver).every(
					(i) => i === donor || neighbors(game, donor).includes(i) || valueOf(d, ruleAt(game, i)) === 0
				)
			)
			.sort((a, b) => valueOf(b, ruleAt(game, receiver)) - valueOf(a, ruleAt(game, receiver)))[0]
	);
}

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

// Consider deterministic equipment effects against public destination criteria.
// Never increase the total a comparison neighbor must beat, even when their
// dice are hidden. Unknown opposition is estimated from the published faces.
function chooseEquipment(game: View, seat: number, policy: AiPolicy): Move | undefined {
	const player = game.players[seat]!;
	if (player.injuries.includes("arm")) return;
	const dice = activeDice(player);
	const peers = neighbors(game, seat);
	const ruleFor = (i: number) =>
		terrain(cell(game, game.players[i]!.path.at(-1) ?? game.players[i]!.position).terrain).requirement;
	const contribution = (roll: Die[], rule: Requirement) =>
		roll.reduce((sum, d) => sum + (matches(face(d), rule) ? d.face : 0), 0);
	const ownRule = ruleFor(seat);
	const own = contribution(dice, ownRule) + player.bonus;
	const rolls = peers.map((i) => activeDice(game.players[i]!));
	if (game.players.length === 2) rolls.push(game.ghost);
	const cdfs = rolls.map((roll) => {
		let cumulative = 0;
		return contributionDistribution(roll, ownRule).map((p) => (cumulative += p));
	});
	const maximum = Array.from({ length: Math.max(...cdfs.map((c) => c.length)) }, (_, score) =>
		cdfs.reduce((p, c) => p * (c[score] ?? 1), 1)
	);
	const metrics = (score: number, aid: boolean) => {
		let win = 0,
			loss = 0;
		maximum.forEach((cdf, other) => {
			const probability = Math.max(0, cdf - (maximum[other - 1] ?? 0));
			const margin = score - other;
			if (margin > 0) win += probability;
			if (!aid)
				loss +=
					probability * (margin <= 0 ? game.difficulty + 2 : Math.max(0, game.difficulty + 2 - Math.ceil(margin / 2)));
		});
		return { win, loss };
	};
	const before = metrics(own, player.aid);
	let best: { move: Move; score: number } | undefined;
	const consider = (move: Move, after: Die[], bonus = 0, aid = false) => {
		const gain = contribution(after, ownRule) + bonus - contribution(dice, ownRule);
		const peerChanges = peers.map((i) => contribution(after, ruleFor(i)) - contribution(dice, ruleFor(i)));
		if (gain < 0 || peerChanges.some((delta) => delta > 0)) return;
		const result = metrics(own + gain, player.aid || aid);
		const score =
			(result.win - before.win) * policy.success * urgency(game, seat) +
			(before.loss - result.loss) * policy.stamina -
			peerChanges.reduce((sum, delta, index) => sum + delta * urgency(game, peers[index]!), 0) * policy.teamwork;
		if (score <= policy.cost) return;
		// Preserve the flexible Pocketknife if a dedicated card is equally good.
		const adjusted = score - (move.id === "knife" ? 0.05 : 0);
		if (!best || adjusted > best.score) best = { move, score: adjusted };
	};
	const offer = (move: Move, score: number) => {
		if (score > policy.cost && (!best || score > best.score)) best = { move, score };
	};
	const phase = game.phase === "planning" ? 2 : 4;
	for (const card of player.cards.filter((c) => c.availableRound <= game.round)) {
		const effects: EquipmentId[] =
			card.id === "knife"
				? EQUIPMENT.filter(
						(effect) =>
							effect.id !== "knife" &&
							game.players.some(
								(p, i) => i !== seat && p.cards.some((c) => c.id === effect.id && c.availableRound <= game.round)
							)
					).map((e) => e.id)
				: [card.id];
		for (const effect of effects.filter((id) =>
			(EQUIPMENT.find((e) => e.id === id)!.phases as readonly number[]).includes(phase)
		)) {
			const move: Move = { action: "equipment", id: card.id, ...(card.id === "knife" ? { copy: effect } : {}) };
			if (effect === "flare") consider(move, dice, 3);
			else if (effect === "aid") consider(move, dice, 0, true);
			else if (effect === "shovel") {
				for (const die of dice)
					for (let value = 1; value <= 6; value++) {
						if (value === die.face) continue;
						consider(
							{ ...move, ids: [die.id], face: value },
							dice.map((d) => (d.id === die.id ? { ...d, face: value } : d))
						);
					}
			} else if (["tape", "compass", "machete"].includes(effect)) {
				const eligible = dice.filter((d) => effect === "machete" || d.face === (effect === "tape" ? 1 : 6));
				for (let mask = 1; mask < 2 ** eligible.length; mask++) {
					const ids = eligible.filter((_, i) => mask & (1 << i)).map((d) => d.id);
					if (effect === "machete" && ids.length > 2) continue;
					const after =
						effect === "machete"
							? dice.filter((d) => !ids.includes(d.id))
							: dice.map((d) => (ids.includes(d.id) ? { ...d, face: 7 - d.face } : d));
					consider({ ...move, ids }, after);
				}
			} else if (effect === "torch" || effect === "water") {
				const ids = dice.filter((d) => rollGain(game, seat, d) > 0.3).map((d) => d.id);
				const gain = dice.filter((d) => ids.includes(d.id)).reduce((sum, d) => sum + rollGain(game, seat, d), 0);
				if (ids.length)
					offer({ ...move, ...(effect === "torch" ? { ids } : { target: seat }) }, gain * urgency(game, seat));
				if (effect === "water")
					for (const other of peers) {
						const known = activeDice(game.players[other]!);
						if (known.every((d) => d.face > 0))
							offer(
								{ ...move, target: other },
								known.reduce((sum, d) => sum + Math.max(0, rollGain(game, other, d)), 0) * urgency(game, other)
							);
					}
			} else if (effect === "map") {
				for (let other = 0; other < game.players.length; other++)
					if (other !== seat) {
						const die = lendingChoice(game, seat, other);
						if (die)
							offer({ ...move, target: other, ids: [die.id] }, valueOf(die, ruleFor(other)) * urgency(game, other));
					}
			} else if (effect === "lighter") {
				for (const other of peers) {
					// Only ask for a visible, useful loan. Hidden dice never justify a guess.
					const die = lendingChoice(game, other, seat);
					if (die) offer({ ...move, target: other }, valueOf(die, ownRule) * urgency(game, seat));
				}
			} else if (effect === "radio") {
				const conflicts = peers.some((i) => contribution(dice, ruleFor(i)) >= 6 * urgency(game, i) ** -1);
				if (!player.radio && peers.some((i) => !game.players[i]!.ready) && (before.win < 0.65 || conflicts))
					offer(move, policy.cost + 0.1);
			} else if (effect === "carabiner") {
				// It forces every player to roll, so require visible evidence of a safe
				// beneficial choice for everyone; otherwise conserve it.
				const gains = game.players.map((p, i) =>
					activeDice(p).some((d) => !d.face) ? -Infinity : Math.max(...activeDice(p).map((d) => rollGain(game, i, d)))
				);
				if (gains.every((g) => g >= 0))
					offer(
						move,
						gains.reduce((sum, g, i) => sum + g * urgency(game, i), 0)
					);
			} else if (effect === "rope") {
				const origin = cell(game, player.position);
				const villageDistance = (id: string) => {
					const c = cell(game, id);
					return Math.min(
						...game.board
							.filter((t) => terrain(t.terrain).kind === "village")
							.map((t) => Math.abs(t.x - c.x) + Math.abs(t.y - c.y))
					);
				};
				for (const c of game.board.filter(
					(c) =>
						walkable(c) &&
						terrain(c.terrain).kind === "land" &&
						!c.eruption &&
						Math.abs(c.x - origin.x) + Math.abs(c.y - origin.y) === 1
				)) {
					if (threatened(game).includes(c.id) || game.players.some((p, i) => i !== seat && p.path.at(-1) === c.id))
						continue;
					const gain = villageDistance(origin.id) - villageDistance(c.id);
					if (gain > 0 || urgency(game, seat) > 1)
						offer({ ...move, tiles: [c.id] }, gain * 2 + (urgency(game, seat) - 1) * 5);
				}
			} else if (effect === "binoculars") {
				const empty = game.board.filter(
					(c) =>
						terrain(c.terrain).kind === "land" &&
						!c.lava &&
						!c.equipment &&
						!c.eruption &&
						!game.players.some((p) => p.position === c.id || p.path.at(-1) === c.id)
				);
				const reachable = new Set(Object.values(paths(game, seat)).map((p) => p.at(-1)));
				for (const a of empty.filter((c) => reachable.has(c.id)))
					for (const b of empty.filter((c) => !reachable.has(c.id))) {
						const old = contribution(dice, terrain(a.terrain).requirement);
						const improved = contribution(dice, terrain(b.terrain).requirement);
						const distance = (c: typeof a) =>
							Math.abs(c.x - cell(game, player.position).x) + Math.abs(c.y - cell(game, player.position).y);
						// Improve a nearby destination without disturbing anyone's chosen tile.
						if (improved > old + 5 && distance(a) <= 2) offer({ ...move, tiles: [a.id, b.id] }, (improved - old) * 0.3);
					}
			}
		}
	}
	return best?.move;
}

export function chooseMove(game: View, seat: number, policy: AiPolicy = DEFAULT_AI_POLICY): Move {
	const p = game.players[seat]!;
	if (game.pending) {
		if (game.pending.kind === "lend") {
			const die = lendingChoice(game, seat, game.pending.receiver!);
			return die ? { action: "respond", ids: [die.id] } : { action: "decline" };
		}
		const dice = activeDice(p).sort((a, b) => rollGain(game, seat, b) - rollGain(game, seat, a));
		const ids = game.pending.required
			? dice.slice(0, 1).map((d) => d.id)
			: dice
					.filter((d) => rollGain(game, seat, d) > 0)
					.slice(0, 6)
					.map((d) => d.id);
		return ids.length ? { action: "respond", ids } : { action: "decline" };
	}
	if (p.pendingInjuries) {
		const injury = ["arm", "eye", "amnesia", "leg"].find((i) => !p.injuries.includes(i as never))!;
		return { action: "injury", injury, die: p.dice.find((d) => d.owner === seat && !d.remove)?.id };
	}
	if (game.phase === "setup")
		return { action: "setup", keep: p.cards.slice(0, SKILLS[p.skill].keep).map((c) => c.id), drop: p.dice.at(-1)?.id };
	if (policy.equipment && ["planning", "equipment"].includes(game.phase)) {
		// An injured manager can still pass unusable cards to an uninjured teammate.
		if (hasSkill(p, "manager") && p.injuries.includes("arm") && p.cards.length) {
			const target = game.players
				.map((other, i) => ({ other, i }))
				.filter(({ other, i }) => i !== seat && !other.injuries.includes("arm"))
				.sort((a, b) => urgency(game, b.i) - urgency(game, a.i))[0];
			if (target) return { action: "give", id: p.cards[0]!.id, target: target.i };
		}
		const equipment = chooseEquipment(game, seat, policy);
		if (equipment) return equipment;
	}
	if (game.phase === "planning") {
		if (mustStay(game, seat)) return p.path.length === 1 ? { action: "ready" } : { action: "plan", path: [p.position] };
		const choices = Object.values(paths(game, seat)).filter(
			(path) =>
				!neighbors(game, seat).some((i) => game.players[i]!.ready && game.players[i]!.path.at(-1) === path.at(-1))
		);
		const preservesEscape = (path: string[]) =>
			neighbors(game, seat).every((other) => {
				if (game.players[other]!.ready) return true;
				return Object.values(paths(game, other)).some(
					(route) =>
						route.at(-1) !== path.at(-1) &&
						!neighbors(game, other).some(
							(i) => i !== seat && game.players[i]!.ready && game.players[i]!.path.at(-1) === route.at(-1)
						)
				);
			});
		const cooperative = choices.filter(preservesEscape);
		if (cooperative.length) choices.splice(0, choices.length, ...cooperative);
		const danger = new Set(threatened(game));
		// A village resident should leave scarce entrances to approaching neighbors.
		// Only public routes matter; never inspect their hidden rolls.
		const arrivals =
			terrain(cell(game, p.position).terrain).kind === "village"
				? neighbors(game, seat)
						.filter(
							(i) =>
								!game.players[i]!.ready && terrain(cell(game, game.players[i]!.position).terrain).kind !== "village"
						)
						.map((i) => {
							const claimed = new Set(
								neighbors(game, i)
									.filter((j) => j !== seat && game.players[j]!.ready)
									.map((j) => game.players[j]!.path.at(-1))
							);
							const options = Object.values(paths(game, i)).filter((route) => {
								const target = cell(game, route.at(-1)!);
								return (
									terrain(target.terrain).kind === "village" &&
									!danger.has(target.id) &&
									!claimed.has(target.id) &&
									!route.slice(1).some((id) => cell(game, id).eruption)
								);
							});
							return { seat: i, options };
						})
				: [];
		const entranceCost = (destination: string) =>
			arrivals.reduce((cost, arrival) => {
				const route = arrival.options.find((route) => route.at(-1) === destination);
				if (!route) return cost;
				// Fewer alternatives and shorter approaches make this entrance more valuable.
				return cost + (18 * urgency(game, arrival.seat)) / arrival.options.length / Math.max(1, route.length - 1);
			}, 0);
		// Measure progress along the trail, including detours around gaps and lava.
		const villageDistances = new Map<string, number>();
		const frontier = game.board.filter((c) => walkable(c) && terrain(c.terrain).kind === "village");
		frontier.forEach((c) => villageDistances.set(c.id, 0));
		for (let i = 0; i < frontier.length; i++) {
			const current = frontier[i]!;
			for (const next of game.board) {
				if (!walkable(next) || villageDistances.has(next.id)) continue;
				if (Math.abs(current.x - next.x) + Math.abs(current.y - next.y) !== 1) continue;
				villageDistances.set(next.id, villageDistances.get(current.id)! + 1);
				frontier.push(next);
			}
		}
		const score = (path: string[]) => {
			const c = cell(game, path.at(-1)!);
			const closestVillage = villageDistances.get(c.id) ?? game.board.length;
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
				expectedLead * policy.lead -
				closestVillage * policy.progress +
				(terrain(c.terrain).kind === "village" ? 8 : 0) +
				(c.equipment ? 1 : 0) -
				(terrain(c.terrain).kind === "village" &&
				!danger.has(c.id) &&
				!path.slice(1).some((id) => cell(game, id).eruption)
					? entranceCost(c.id) - entranceCost(p.position)
					: 0) -
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
		if (policy.equipment && hasSkill(p, "buddy") && !p.buddyUsed) {
			const conflicts = (d: Die) =>
				neighbors(game, seat).reduce((sum, i) => sum + valueOf(d, ruleAt(game, i)) * urgency(game, i), 0);
			const die = activeDice(p)
				.filter((d) => valueOf(d, r) === 0 && conflicts(d) > 0)
				.sort((a, b) => conflicts(b) - conflicts(a))[0];
			if (die) return { action: "buddy", ids: [die.id] };
		}
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
