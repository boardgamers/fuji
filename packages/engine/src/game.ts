import seedrandom from "seedrandom";
import {
	DICE,
	EQUIPMENT,
	EXHAUSTION,
	INJURIES,
	INJURY_AT,
	SCENARIO_ONE,
	SKILLS,
	CHARACTERS,
	terrain,
	requirementLabel,
	matches,
	equipment,
	type Skill,
	type EquipmentId,
	type Injury,
} from "./data.js";
import type { State, View, Player, Die, Cell, Move, ResolvedFace, PlanningSnapshot } from "./types.js";
export const assert = (ok: unknown, message: string): asserts ok => {
	if (!ok) throw Error(message);
};
export function face(d: Die): ResolvedFace {
	return { value: d.face, color: DICE[d.type]?.[d.face - 1] ?? "blue" };
}
function random(s: State): number {
	return seedrandom(`${s.seed}:${s.counter++}`)();
}
function shuffle<T>(s: State, items: T[]): T[] {
	const a = [...items];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(random(s) * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}
function roll(s: State, dice: Die[]) {
	for (const d of dice) d.face = 1 + Math.floor(random(s) * 6);
}
export function cell(s: State | View, id: string): Cell {
	const c = s.board.find((c) => c.id === id);
	if (!c) throw Error("Unknown location");
	return c;
}
export function neighbors(s: State | View, seat: number): number[] {
	const n = s.players.length;
	return [...new Set([(seat + n - 1) % n, (seat + 1) % n])];
}
export function hasSkill(p: Player, skill: Skill) {
	return p.skill === skill && !p.injuries.includes("amnesia");
}
export function activeDice(p: Player) {
	return p.dice.filter((d) => !d.aside);
}
export function distance(a: Cell, b: Cell) {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function walkable(c: Cell) {
	return !c.lava && !["rubble", "volcano"].includes(terrain(c.terrain).kind);
}
export function paths(s: State | View, seat: number, max?: number): Record<string, string[]> {
	const p = s.players[seat];
	if (!p) return {};
	const limit = max ?? (hasSkill(p, "scout") ? 4 : 3);
	const found: Record<string, string[]> = { [p.position]: [p.position] };
	const queue = [found[p.position]!];
	while (queue.length) {
		const path = queue.shift()!;
		if (path.length - 1 >= limit) continue;
		const last = cell(s, path.at(-1)!);
		for (const next of s.board.filter((c) => walkable(c) && distance(last, c) === 1)) {
			if (path.includes(next.id)) continue;
			const candidate = [...path, next.id];
			const previous = found[next.id];
			const eruptions = (route: string[]) => route.slice(1).reduce((sum, id) => sum + cell(s, id).eruption, 0);
			if (
				!previous ||
				eruptions(candidate) < eruptions(previous) ||
				(eruptions(candidate) === eruptions(previous) && candidate.length < previous.length)
			)
				found[next.id] = candidate;
			// Explore all bounded simple paths: a longer, safer prefix may lead to
			// a different optimum, so finding a location must not stop the search.
			queue.push(candidate);
		}
	}
	return found;
}
export function rerollAllowance(s: State | View, seat: number, path?: string[]): number {
	const p = s.players[seat]!;
	const chosen = path ?? p.path;
	const dist = chosen.length - 1;
	if (hasSkill(p, "scout") && dist === 4) return 0;
	const base = p.injuries.includes("eye")
		? 0
		: (dist === 0 ? 2 : dist <= 2 ? 1 : 0) + (terrain(cell(s, chosen.at(-1)!).terrain).reroll ? 1 : 0);
	return base + (hasSkill(p, "survivalist") ? 1 : 0);
}
export function total(p: Player, tile: number): number {
	return activeDice(p).reduce((n, d) => n + (matches(face(d), terrain(tile).requirement) ? d.face : 0), 0);
}
export function comparison(s: State | View, seat: number) {
	const p = s.players[seat]!;
	const tile = cell(s, p.path.at(-1) ?? p.position).terrain;
	const own = total(p, tile) + p.bonus;
	const peers = neighbors(s, seat).map((i) => ({ seat: i, total: total(s.players[i]!, tile) }));
	if (s.players.length === 2)
		peers.push({
			seat: -1,
			total: s.ghost.reduce((n, d) => n + (matches(face(d), terrain(tile).requirement) ? d.face : 0), 0),
		});
	const highest = Math.max(...peers.map((p) => p.total));
	const margin = own - highest;
	const loss = p.aid ? 0 : margin <= 0 ? s.difficulty + 2 : Math.max(0, s.difficulty + 2 - Math.ceil(margin / 2));
	return { own, peers, margin, loss, success: margin > 0 };
}
function event(s: State, text: string, type: State["log"][number]["type"] = "move", detail = false) {
	s.log.push({ round: s.round, text, type, ...(detail ? { detail: true } : {}) });
}

function diceEvent(s: State, label: string, dice: Die[]) {
	const values =
		dice.map((d) => `${face(d).color} ${d.face}${d.aside ? " (set aside)" : ""}`).join(", ") || "no matching dice";
	s.log.push({
		round: s.round,
		type: "move",
		text: `${label}: ${values}.`,
		diceLabel: label,
		dice: structuredClone(dice),
	});
}
function phase(s: State, next: State["phase"]) {
	s.phase = next;
	for (const p of s.players) {
		p.ready = false;
		p.radio = false;
	}
	event(
		s,
		{
			setup: "Prepare your expedition",
			planning: "Choose your routes",
			reroll: "Reroll in silence",
			equipment: "Use equipment",
			movement: "Reveal and move",
			eruption: "The volcano erupts",
			ended: "Expedition complete",
		}[next],
		"phase"
	);
	if (next === "planning") s.log.at(-1)!.sound = "dice";
	if (next === "movement") {
		for (const p of s.players) diceEvent(s, `${p.name} revealed their dice`, p.dice);
		if (s.ghost.length) diceEvent(s, "Neutral dice revealed", s.ghost);
	}
}
function end(s: State, outcome: "won" | "lost", reason: string) {
	delete s.pendingHelpers;
	s.outcome = outcome;
	s.reason = reason;
	s.phase = "ended";
	s.pending = null;
	event(s, reason, "end");
}
function win(s: State) {
	if (s.players.every((p) => terrain(cell(s, p.position).terrain).kind === "village"))
		end(s, "won", "Everyone reached the village.");
}
function draw(s: State, p: Player, availableRound = s.round + 1) {
	const id = s.deck.shift();
	if (id) p.cards.push({ id, used: 0, availableRound });
}
function collect(s: State, p: Player) {
	const c = cell(s, p.position);
	if (c.equipment) {
		c.equipment = false;
		draw(s, p);
		event(s, `${p.name} found equipment.`, "equipment");
	}
}
export function threatened(s: State | View): string[] {
	return s.board.filter((c) => !c.lava && s.board.some((l) => l.lava && distance(c, l) === 1)).map((c) => c.id);
}
function erupt(s: State) {
	const next = threatened(s);
	for (const c of s.board) if (next.includes(c.id)) c.lava = true;
	event(s, `Lava consumed ${next.length} location${next.length === 1 ? "" : "s"}.`, "eruption");
	s.log.at(-1)!.animation = { kind: "eruption", cells: next };
	const victim = s.players.find((p) => cell(s, p.position).lava);
	if (victim) end(s, "lost", `${victim.name} was caught by the lava.`);
}
function trigger(s: State, path: string[]) {
	for (const id of path) {
		const c = cell(s, id);
		const count = c.eruption;
		c.eruption = 0;
		for (let i = 0; i < count && !s.outcome; i++) erupt(s);
	}
}
function startRound(s: State) {
	s.round++;
	s.activeResolution = null;
	s.pending = null;
	const all = s.players.flatMap((p) => p.dice).filter((d) => !d.remove);
	for (let i = 0; i < s.players.length; i++) {
		const p = s.players[i]!;
		p.dice = all.filter((d) => d.owner === i);
		for (const d of p.dice) d.aside = false;
		p.path = [p.position];
		p.resolved = false;
		p.buddyUsed = false;
		p.aid = false;
		p.bonus = 0;
		p.rerolls = 0;
		roll(s, p.dice);
	}
	roll(s, s.ghost);
	phase(s, "planning");
}
export function initGame(players = 3, options: Record<string, unknown> = {}, seed = "fuji"): State {
	if (!Number.isInteger(players) || players < 2 || players > 4) throw Error("Fuji supports 2–4 players.");
	const difficulty = Number(options.difficulty ?? 1);
	if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 4) throw Error("Choose difficulty 1–4.");
	if (options.scenario !== undefined && Number(options.scenario) !== 1)
		throw Error("This edition currently implements scenario 1.");
	const s: State = {
		schemaVersion: 1,
		seed,
		counter: 0,
		round: 0,
		phase: "setup",
		players: [],
		board: [],
		deck: [],
		discard: [],
		difficulty,
		log: [],
		revision: 0,
		outcome: null,
		reason: "",
		activeResolution: null,
		pending: null,
		ghost: [],
		ghostVisible: [],
		history: [],
		initOptions: { autoMovement: true, autoProgress: true, ...options },
	};
	const lands = shuffle(
		s,
		Array.from({ length: 24 }, (_, i) => i + 4)
	);
	const villages = shuffle(s, [28, 29, 30, 31, 32, 33]);
	let rubble = 2;
	SCENARIO_ONE.forEach((row, y) =>
		row.forEach((code, x) => {
			if (code === " " || (code === "V4" && players !== 4)) return;
			const village = code.startsWith("v") || code === "V4";
			const id = code === "V" ? 1 : code === "R" ? rubble++ : village ? villages.shift()! : lands.shift()!;
			s.board.push({
				id: `${x},${y}`,
				x,
				y,
				terrain: id,
				lava: code === "V",
				equipment: code.includes("E"),
				eruption: code === "X" ? 1 : 0,
			});
		})
	);
	s.deck = shuffle(
		s,
		EQUIPMENT.map((c) => c.id)
	);
	const skillList: Skill[] = Array.isArray(options.skills)
		? (options.skills as Skill[])
		: (["buddy", "gatherer", "manager", "survivalist"] as Skill[]);
	if (skillList.length < players || skillList.some((x) => !(x in SKILLS))) throw Error("Invalid skill selection.");
	for (let i = 0; i < players; i++) {
		const skill = skillList[i]!;
		const pos = players === 4 && i >= 2 ? "1,2" : "0,3";
		const p: Player = {
			name: CHARACTERS[i]!,
			character: i,
			skill,
			position: pos,
			path: [pos],
			dice: Array.from({ length: 6 }, (_, j) => ({
				id: `${i}-${j}`,
				type: Math.floor(j / 2),
				owner: i,
				face: 0,
				aside: false,
				remove: false,
			})),
			cards: [],
			stamina: 0,
			injuries: [],
			pendingInjuries: 0,
			ready: false,
			rerolls: 0,
			powerBars: 0,
			radio: false,
			aid: false,
			bonus: 0,
			resolved: false,
			setupDone: SKILLS[skill].draw === SKILLS[skill].keep && SKILLS[skill].dice === 6,
			buddyUsed: false,
		};
		for (let j = 0; j < SKILLS[skill].draw; j++) draw(s, p, 1);
		s.players.push(p);
	}
	if (players === 2) {
		s.ghost = Array.from({ length: 6 }, (_, j) => ({
			id: `ghost-${j}`,
			type: Math.floor(j / 2),
			owner: -1,
			face: 0,
			aside: false,
			remove: false,
		}));
		s.ghostVisible = s.ghost.filter((_, j) => j % 2 === 0).map((d) => d.id);
	}
	event(s, "Scenario 1 · the path to the village", "phase");
	if (s.players.every((p) => p.setupDone)) startRound(s);
	return s;
}
function strings(value: unknown, max = 6): string[] {
	if (
		!Array.isArray(value) ||
		value.length > max ||
		value.some((x) => typeof x !== "string") ||
		new Set(value).size !== value.length
	)
		throw Error("Invalid selection.");
	return [...value] as string[];
}
function integer(value: unknown, min: number, max: number) {
	if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
		throw Error("Invalid choice.");
	return value;
}
function selectedDice(p: Player, value: unknown, min = 0, max = 6): Die[] {
	const ids = strings(value, max);
	if (ids.length < min) throw Error("Select a die.");
	return ids.map((id) => {
		const d = p.dice.find((d) => d.id === id && !d.aside);
		if (!d) throw Error("This die is unavailable.");
		return d;
	});
}
function validatePath(s: State, p: Player, input: unknown, max: number) {
	const route = strings(input, 5);
	if (!route.length || route[0] !== p.position || route.length - 1 > max) throw Error("Choose a reachable route.");
	for (let i = 1; i < route.length; i++) {
		if (!walkable(cell(s, route[i]!)) || distance(cell(s, route[i - 1]!), cell(s, route[i]!)) !== 1)
			throw Error("The route must follow adjacent safe locations.");
	}
	return route;
}
function resetReady(s: State) {
	for (const p of s.players) p.ready = false;
}
function afterMovement(s: State) {
	delete s.pendingHelpers;
	if (s.outcome) return;
	if (s.players.some((p) => p.pendingInjuries)) return;
	s.activeResolution = null;
	if (s.players.every((p) => p.resolved)) phase(s, "eruption");
}
function finishPending(s: State) {
	if (s.pending?.players.length === 0) s.pending = null;
}
function useEquipment(s: State, seat: number, m: Move) {
	const p = s.players[seat]!;
	if (s.phase !== "planning" && s.phase !== "equipment") throw Error("Equipment cannot be used in this phase.");
	if (p.injuries.includes("arm")) throw Error("Your arm injury prevents equipment use.");
	const card = p.cards.find((c) => c.id === m.id);
	if (!card || card.availableRound > s.round) throw Error("This equipment is not available yet.");
	let id = card.id;
	if (id === "knife") {
		const copied = EQUIPMENT.find((c) => c.id === m.copy && c.id !== "knife");
		if (
			!copied ||
			!s.players.some(
				(other, i) => i !== seat && other.cards.some((c) => c.id === copied.id && c.availableRound <= s.round)
			)
		)
			throw Error("Choose another player’s available equipment.");
		id = copied.id;
	}
	const info = equipment(id);
	if (!(info.phases as readonly number[]).includes(s.phase === "planning" ? 2 : 4))
		throw Error("This equipment is not usable in this phase.");
	const target = () => integer(m.target, 0, s.players.length - 1);
	let setAside: Die[] | undefined;
	let effectText = "";
	switch (id) {
		case "binoculars": {
			const ids = strings(m.tiles, 2);
			if (ids.length !== 2) throw Error("Choose two land locations.");
			const [a, b] = ids.map((id) => cell(s, id)) as [Cell, Cell];
			for (const c of [a, b])
				if (
					terrain(c.terrain).kind !== "land" ||
					c.lava ||
					c.equipment ||
					c.eruption ||
					s.players.some((p) => p.position === c.id || (p.path.length > 0 && p.path.at(-1) === c.id))
				)
					throw Error("Both land locations must be completely empty.");
			effectText = `swapped ${terrain(a.terrain).name} and ${terrain(b.terrain).name}`;
			[a.terrain, b.terrain] = [b.terrain, a.terrain];
			break;
		}
		case "flare":
			p.bonus += 3;
			effectText = "+3 movement value";
			break;
		case "rope": {
			const ids = strings(m.tiles, 1);
			if (ids.length !== 1) throw Error("Choose an adjacent land location.");
			const c = cell(s, ids[0]!);
			if (!walkable(c) || terrain(c.terrain).kind !== "land" || distance(cell(s, p.position), c) !== 1)
				throw Error("Choose an adjacent land location.");
			event(s, `${p.name} moved to ${terrain(c.terrain).name} using Rope.`);
			s.log.at(-1)!.animation = { kind: "move", seat, path: [p.position, c.id] };
			p.position = c.id;
			collect(s, p);
			trigger(s, [c.id]);
			if (s.phase === "planning") {
				p.path = [p.position];
			}
			win(s);
			break;
		}
		case "shovel": {
			const d = selectedDice(p, m.ids, 1, 1)[0]!;
			d.face = integer(m.face, 1, 6);
			effectText = "turned 1 die";
			break;
		}
		case "torch": {
			const dice = selectedDice(p, m.ids, 1);
			roll(s, dice);
			effectText = `rerolled ${dice.length} ${dice.length === 1 ? "die" : "dice"}`;
			break;
		}
		case "water": {
			const recipient = target();
			s.pending = {
				kind: "reroll",
				equipment: id,
				players: [recipient],
				remaining: recipient === seat ? 2 : 1,
				required: false,
			};
			effectText = `${s.players[recipient]!.name} gets ${recipient === seat ? "up to 2 rerolls" : "1 reroll"}`;
			break;
		}
		case "aid":
			p.aid = true;
			effectText = "no stamina loss this round";
			break;
		case "radio":
			p.radio = true;
			effectText = "dice revealed to teammates for this phase";
			break;
		case "tape":
		case "compass": {
			const dice = selectedDice(p, m.ids, 1);
			const from = id === "tape" ? 1 : 6;
			if (dice.some((d) => d.face !== from)) throw Error(`Select dice showing ${from}.`);
			for (const d of dice) d.face = 7 - from;
			effectText = `turned ${dice.length} ${dice.length === 1 ? "die" : "dice"}`;
			break;
		}
		case "machete":
			setAside = selectedDice(p, m.ids, 1, 2);
			for (const d of setAside) d.aside = true;
			break;
		case "lighter": {
			const donor = target();
			if (donor === seat) throw Error("Choose a teammate.");
			s.pending = { kind: "lend", equipment: id, players: [donor], receiver: seat, remaining: 1, required: false };
			effectText = `asked ${s.players[donor]!.name} to lend a die`;
			break;
		}
		case "carabiner":
			s.pending = { kind: "reroll", equipment: id, players: s.players.map((_, i) => i), remaining: 1, required: true };
			effectText = "everyone rerolls 1 die";
			break;
		case "map": {
			const recipient = target();
			if (recipient === seat) throw Error("Choose a teammate.");
			const d = selectedDice(p, m.ids, 1, 1)[0]!;
			p.dice = p.dice.filter((x) => x.id !== d.id);
			s.players[recipient]!.dice.push(d);
			effectText = `lent 1 die to ${s.players[recipient]!.name} until the end of the round`;
			break;
		}
	}
	card.used++;
	if (!hasSkill(p, "tinkerer") || card.used >= 2) {
		p.cards = p.cards.filter((c) => c !== card);
		s.discard.push(card.id);
	}
	resetReady(s);
	event(
		s,
		`${p.name} used ${equipment(card.id).name}${id !== card.id ? ` as ${info.name}` : ""}${effectText ? ` · ${effectText}` : ""}.`,
		"equipment"
	);
	if (id === "torch") s.log.at(-1)!.sound = "dice";
	if (setAside) s.log.at(-1)!.setAside = structuredClone(setAside);
}
function execute(s: State, m: Move, seat: number) {
	if (s.outcome) throw Error("The expedition has ended.");
	const p = s.players[seat];
	if (!p) throw Error("Invalid player.");
	if (s.pending) {
		const pending = s.pending;
		const source = pending.equipment ? equipment(pending.equipment).name : "equipment";
		let responseText =
			pending.kind === "lend"
				? `declined the loan to ${s.players[pending.receiver!]!.name}`
				: `skipped the remaining ${source} reroll${pending.remaining === 1 ? "" : "s"}`;
		if (!pending.players.includes(seat)) throw Error("Waiting for another player.");
		if (m.action === "decline") {
			if (pending.required) throw Error("This reroll is mandatory.");
			pending.players = pending.players.filter((i) => i !== seat);
		} else if (m.action === "respond") {
			const dice = selectedDice(p, m.ids, pending.required ? 1 : 0, pending.required ? 1 : 6);
			if (pending.kind === "lend") {
				if (dice.length !== 1) throw Error("Choose one die to lend.");
				const d = dice[0]!;
				p.dice = p.dice.filter((x) => x !== d);
				s.players[pending.receiver!]!.dice.push(d);
				responseText = `lent 1 die to ${s.players[pending.receiver!]!.name} until the end of the round`;
				pending.players = [];
			} else {
				roll(s, dice);
				responseText = `rerolled ${dice.length} ${dice.length === 1 ? "die" : "dice"} with ${source}`;
				pending.remaining--;
				if (pending.required || pending.remaining <= 0) pending.players = pending.players.filter((i) => i !== seat);
			}
		} else throw Error("Resolve the equipment effect first.");
		event(s, `${p.name} ${responseText}.`, "equipment");
		if (pending.kind === "reroll") s.log.at(-1)!.sound = "dice";
		finishPending(s);
		return;
	}
	if (s.players.some((p) => p.pendingInjuries) && m.action !== "injury") throw Error("Choose an injury first.");
	switch (m.action) {
		case "setup": {
			if (s.phase !== "setup" || p.setupDone) throw Error("Preparation is already complete.");
			const keep = strings(m.keep, 4);
			const spec = SKILLS[p.skill];
			if (keep.length !== spec.keep || keep.some((id) => !p.cards.some((c) => c.id === id)))
				throw Error(`Keep ${spec.keep} equipment card(s).`);
			if (spec.dice === 5) {
				const d = p.dice.find((d) => d.id === m.drop);
				if (!d) throw Error("Choose one die to leave behind.");
				p.dice = p.dice.filter((x) => x !== d);
			}
			const rest = p.cards.filter((c) => !keep.includes(c.id));
			p.cards = p.cards.filter((c) => keep.includes(c.id));
			s.deck.push(...rest.map((c) => c.id));
			p.setupDone = true;
			if (s.players.every((p) => p.setupDone)) startRound(s);
			break;
		}
		case "plan": {
			if (s.phase !== "planning") throw Error("Routes are locked for this round.");
			const route = validatePath(s, p, m.path, hasSkill(p, "scout") ? 4 : 3);
			if (neighbors(s, seat).some((i) => s.players[i]!.path.at(-1) === route.at(-1) && s.players[i]!.ready))
				throw Error("A neighbor has already selected that destination.");
			p.path = route;
			p.ready = false;
			break;
		}
		case "ready": {
			if (s.phase !== "planning" && s.phase !== "equipment") throw Error("You cannot confirm in this phase.");
			if (p.ready) throw Error("Already ready.");
			if (s.phase === "planning") {
				validatePath(s, p, p.path, hasSkill(p, "scout") ? 4 : 3);
				if (neighbors(s, seat).some((i) => s.players[i]!.ready && s.players[i]!.path.at(-1) === p.path.at(-1)))
					throw Error("Neighbors need different destinations.");
			}
			p.ready = true;
			if (s.phase !== "planning") event(s, `${p.name} is ready.`, "move", true);
			if (s.players.every((p) => p.ready)) {
				if (s.phase === "planning") {
					for (const [seat, player] of s.players.entries()) {
						event(
							s,
							`${player.name} chose ${terrain(cell(s, player.path.at(-1)!).terrain).name} · ${player.path.length - 1} steps · ${rerollAllowance(s, seat)} rerolls.`
						);
						s.log.at(-1)!.route = {
							name: player.name,
							character: player.character,
							rerolls: rerollAllowance(s, seat),
							cells: player.path.map((id) => {
								const c = cell(s, id);
								return { terrain: c.terrain, eruption: c.eruption, equipment: c.equipment };
							}),
						};
					}
					phase(s, "reroll");
					s.players.forEach((p, i) => {
						p.rerolls = rerollAllowance(s, i);
					});
				} else phase(s, "movement");
			}
			break;
		}
		case "reroll": {
			if (s.phase !== "reroll" || p.ready || p.rerolls < 1) throw Error("No rerolls available.");
			const dice = selectedDice(p, m.ids, 1);
			roll(s, dice);
			p.rerolls--;
			event(s, `${p.name} rerolled.`);
			s.log.at(-1)!.sound = "dice";
			break;
		}
		case "finishRerolls": {
			if (s.phase !== "reroll" || p.ready) throw Error("Rerolls are already complete.");
			if (hasSkill(p, "gatherer")) p.powerBars = Math.min(3, p.powerBars + p.rerolls);
			p.rerolls = 0;
			p.ready = true;
			if (s.players.every((p) => p.ready)) phase(s, "equipment");
			break;
		}
		case "buddy": {
			if (s.phase !== "reroll" || p.ready || !hasSkill(p, "buddy") || p.buddyUsed)
				throw Error("This skill is unavailable.");
			const die = selectedDice(p, m.ids, 1, 1)[0]!;
			die.aside = true;
			p.buddyUsed = true;
			event(s, `${p.name} set a die aside.`);
			s.log.at(-1)!.setAside = [structuredClone(die)];
			break;
		}
		case "give": {
			if (!hasSkill(p, "manager")) throw Error("Only the Equipment manager can give equipment.");
			const target = integer(m.target, 0, s.players.length - 1);
			if (target === seat) throw Error("Choose a teammate.");
			const c = p.cards.find((c) => c.id === m.id);
			if (!c) throw Error("Unknown equipment.");
			p.cards = p.cards.filter((x) => x !== c);
			s.players[target]!.cards.push(c);
			if (s.phase === "planning" || s.phase === "equipment") resetReady(s);
			event(s, `${p.name} gave ${equipment(c.id).name} to ${s.players[target]!.name}.`, "equipment");
			s.log.at(-1)!.transfer = { id: c.id, from: p.name, to: s.players[target]!.name };
			break;
		}
		case "equipment":
			useEquipment(s, seat, m);
			break;
		case "beginMovement": {
			if (s.phase !== "movement" || s.activeResolution !== null || p.resolved)
				throw Error("Choose an unresolved player to move.");
			s.activeResolution = seat;
			event(s, `${p.name} is resolving their journey.`, "move", true);
			s.pendingHelpers = s.players.flatMap((helper, i) =>
				hasSkill(helper, "gatherer") && helper.powerBars > 0 ? [i] : []
			);
			finishAssistance(s, seat);
			break;
		}
		case "help": {
			if (s.phase !== "movement" || s.activeResolution === null || !s.pendingHelpers?.includes(seat))
				throw Error("No power bar decision is expected from you.");
			const count = integer(m.count, 0, p.powerBars);
			const actor = s.activeResolution;
			p.powerBars -= count;
			s.players[actor]!.bonus += count;
			s.pendingHelpers = s.pendingHelpers.filter((i) => i !== seat);
			event(
				s,
				count
					? `${p.name} used ${count} power bar(s) to help ${s.players[actor]!.name}.`
					: `${p.name} kept their power bars.`
			);
			finishAssistance(s, actor);
			break;
		}
		case "bar": {
			if (s.pendingHelpers) throw Error("Choose how many power bars to use in one decision.");
			if (s.phase !== "movement" || s.activeResolution === null || !hasSkill(p, "gatherer") || p.powerBars < 1)
				throw Error("No power bar is available now.");
			p.powerBars--;
			s.players[s.activeResolution]!.bonus++;
			event(s, `${p.name} used a power bar.`);
			break;
		}
		case "resolve": {
			if (s.pendingHelpers?.length) throw Error("Waiting for the Gatherer’s decision.");
			if (s.phase !== "movement" || s.activeResolution !== seat || p.resolved)
				throw Error("It is not your movement turn.");
			const dest = p.path.at(-1)!;
			let route = p.path;
			if (route[0] !== p.position) route = paths(s, seat)[dest] ?? [];
			if (m.path !== undefined) {
				route = validatePath(s, p, m.path, hasSkill(p, "scout") ? 4 : 3);
				if (route.at(-1) !== dest) throw Error("Your destination cannot change.");
			}
			const result = comparison(s, seat);
			const criterion = terrain(cell(s, dest).terrain);
			event(s, `Dice comparison at ${criterion.name}: ${requirementLabel(criterion.requirement)}.`, "move", true);
			const participants: NonNullable<State["log"][number]["journey"]>["participants"] = [];
			for (const participant of [{ seat, total: result.own }, ...result.peers]) {
				const owner = participant.seat === -1 ? null : s.players[participant.seat]!;
				const counted = (owner ? activeDice(owner) : s.ghost).filter((d) => matches(face(d), criterion.requirement));
				const bonus = participant.seat === seat ? p.bonus : 0;
				diceEvent(
					s,
					`${owner?.name ?? "Neutral dice"} · matching total ${participant.total}${bonus ? ` (including +${bonus} bonus)` : ""}`,
					counted
				);
				s.log.at(-1)!.detail = true;
				participants.push({
					name: owner?.name ?? "Neutral dice",
					total: participant.total,
					bonus,
					dice: structuredClone(counted),
				});
			}
			let canMove = result.success && route.length > 0;
			if (route.slice(1).some((id) => !walkable(cell(s, id)))) canMove = false;
			const journey: NonNullable<State["log"][number]["journey"]> = {
				name: p.name,
				character: p.character,
				terrain: criterion.id,
				moved: canMove && dest !== p.position,
				reason: !result.success
					? "comparison"
					: !canMove
						? "blocked"
						: dest === p.position
							? "planned-stay"
							: "success",
				own: result.own,
				highest: Math.max(...result.peers.map((x) => x.total)),
				loss: null,
				participants,
			};
			if (canMove) {
				p.position = dest;
				event(
					s,
					`${p.name} reached ${terrain(cell(s, dest).terrain).name} (${result.own} vs ${Math.max(...result.peers.map((x) => x.total))}).`
				);
				s.log.at(-1)!.journey = journey;
				if (journey.moved) s.log.at(-1)!.animation = { kind: "move", seat, path: [...route] };
				win(s);
				if (s.outcome) break;
				collect(s, p);
				trigger(s, route.slice(1));
				if (s.outcome) break;
			} else {
				event(s, `${p.name} stayed in place (${result.own} vs ${Math.max(...result.peers.map((x) => x.total))}).`);
				s.log.at(-1)!.journey = journey;
			}
			const loss = p.aid ? 0 : canMove ? result.loss : s.difficulty + 2;
			const old = p.stamina;
			p.stamina = Math.min(EXHAUSTION, p.stamina + loss);
			p.pendingInjuries += INJURY_AT.filter((n) => n > old && n <= p.stamina).length;
			journey.loss = loss;
			event(s, `${p.name} lost ${loss} stamina.`, "move", true);
			p.resolved = true;
			if (p.stamina >= EXHAUSTION) end(s, "lost", `${p.name} collapsed from exhaustion.`);
			else afterMovement(s);
			break;
		}
		case "injury": {
			if (!p.pendingInjuries || !INJURIES.includes(m.injury as Injury) || p.injuries.includes(m.injury as Injury))
				throw Error("Choose a new injury.");
			const injury = m.injury as Injury;
			if (injury === "leg") {
				const d = s.players.flatMap((p) => p.dice).find((d) => d.id === m.die);
				if (!d || d.owner !== seat || d.remove) throw Error("Choose one of your own dice.");
				d.remove = true;
			}
			if (injury === "amnesia" && p.skill === "tinkerer") {
				const discarded = p.cards.filter((c) => c.used > 0);
				s.discard.push(...discarded.map((c) => c.id));
				p.cards = p.cards.filter((c) => c.used === 0);
			}
			p.injuries.push(injury);
			p.pendingInjuries--;
			event(s, `${p.name} suffered ${injury === "amnesia" ? "amnesia" : `a ${injury} injury`}.`, "injury");
			afterMovement(s);
			break;
		}
		case "erupt":
			if (s.phase !== "eruption") throw Error("It is not time for an eruption.");
			erupt(s);
			if (!s.outcome) startRound(s);
			break;
		default:
			throw Error("Unknown action.");
	}
}
// Evaluate the at-most-24 remaining orders using the actual resolution rules.
// These previews assume no additional bars or injury effects: those remain player
// choices, and the order is recalculated after each decision. Preview mutations,
// equipment draws and journal entries are confined to clones.
function movementOrder(s: State): number[] {
	const remaining = s.players.flatMap((p, i) => (p.resolved ? [] : [i]));
	let best: number[] = [];
	let bestScore: number[] | undefined;
	function visit(preview: State, rest: number[], order: number[]) {
		if (!rest.length || preview.outcome) {
			const score = [
				preview.outcome === "won" ? 2 : preview.outcome === "lost" ? 0 : 1,
				preview.players.filter((p) => terrain(cell(preview, p.position).terrain).kind === "village").length,
				preview.players.filter((p, i) => p.position !== s.players[i]!.position).length,
				-preview.players.reduce((sum, p) => sum + p.stamina, 0),
				-preview.players.filter((p) => threatened(preview).includes(p.position)).length,
			];
			const different = bestScore ? score.findIndex((value, i) => value !== bestScore![i]) : -1;
			if (!bestScore || (different >= 0 && score[different]! > bestScore[different]!)) {
				best = [...order, ...rest];
				bestScore = score;
			}
			return;
		}
		for (const seat of rest) {
			const next = structuredClone(preview);
			next.activeResolution = seat;
			delete next.pendingHelpers;
			execute(next, { action: "resolve" }, seat);
			// Injury effects are not guessed. Stop for the real choice during play.
			for (const p of next.players) p.pendingInjuries = 0;
			visit(
				next,
				rest.filter((i) => i !== seat),
				[...order, seat]
			);
		}
	}
	// A stable tie-break favours routes without eruption triggers, then seat order.
	remaining.sort((a, b) => {
		const triggers = (i: number) => s.players[i]!.path.slice(1).reduce((n, id) => n + cell(s, id).eruption, 0);
		return triggers(a) - triggers(b) || a - b;
	});
	visit(s, remaining, []);
	return best;
}
export function powerBarChoices(s: State | View, helper: number): number[] {
	if (s.phase !== "movement" || s.activeResolution === null || !s.pendingHelpers?.includes(helper)) return [];
	const actor = s.players[s.activeResolution]!;
	const base = comparison(s, s.activeResolution);
	const others = s.pendingHelpers.filter((i) => i !== helper).reduce((n, i) => n + s.players[i]!.powerBars, 0);
	const outcome = (bars: number) => {
		const margin = base.margin + bars;
		const success = margin > 0;
		const loss = actor.aid ? 0 : !success ? s.difficulty + 2 : Math.max(0, s.difficulty + 2 - Math.ceil(margin / 2));
		return `${success}:${loss}`;
	};
	return Array.from({ length: s.players[helper]!.powerBars }, (_, i) => i + 1).filter((count) =>
		Array.from({ length: others + 1 }, (_, i) => i).some(
			(other) => outcome(count + other) !== outcome(count - 1 + other)
		)
	);
}
function finishAssistance(s: State, seat: number) {
	if (s.initOptions.autoProgress === true && s.pendingHelpers?.length) {
		const before = comparison(s, seat);
		const preview = structuredClone(s);
		preview.players[seat]!.bonus += s.pendingHelpers.reduce((sum, i) => sum + s.players[i]!.powerBars, 0);
		const after = comparison(preview, seat);
		if (before.success === after.success && before.loss === after.loss) s.pendingHelpers = [];
	}
	if (!s.pendingHelpers?.length) execute(s, { action: "resolve" }, seat);
}
function advanceRerolls(s: State) {
	if (s.phase !== "reroll") return;
	for (const p of s.players) {
		if (p.ready) continue;
		const diceAvailable = activeDice(p).length > 0;
		const canSetAside = diceAvailable && hasSkill(p, "buddy") && !p.buddyUsed;
		if (canSetAside || (diceAvailable && p.rerolls > 0)) continue;
		if (hasSkill(p, "gatherer")) p.powerBars = Math.min(3, p.powerBars + p.rerolls);
		p.rerolls = 0;
		p.ready = true;
	}
	if (s.players.every((p) => p.ready)) phase(s, "equipment");
}
function advanceMovement(s: State) {
	if (s.initOptions.autoMovement !== true) return;
	while (
		s.phase === "movement" &&
		!s.outcome &&
		s.activeResolution === null &&
		!s.players.some((p) => p.pendingInjuries)
	) {
		const seat = movementOrder(s)[0];
		if (seat === undefined) break;
		execute(s, { action: "beginMovement" }, seat);
	}
}
// Only public facts may determine automatic passes. Testing Tape/Compass against
// private faces here would reveal hidden dice through readiness changes.
function advanceForcedActions(s: State) {
	advanceRerolls(s);
	if (s.initOptions.autoProgress !== true) {
		advanceMovement(s);
		return;
	}
	while (!s.outcome) {
		const forcedInjury = s.players.findIndex(
			(p) =>
				p.pendingInjuries > 0 &&
				INJURIES.filter((injury) => !p.injuries.includes(injury)).length === 1 &&
				p.injuries.includes("leg")
		);
		if (forcedInjury >= 0) {
			const injury = INJURIES.find((injury) => !s.players[forcedInjury]!.injuries.includes(injury))!;
			execute(s, { action: "injury", injury }, forcedInjury);
			continue;
		}
		if (s.pending || s.players.some((p) => p.pendingInjuries)) break;
		if (s.phase === "equipment") {
			for (const p of s.players) {
				const canGive = hasSkill(p, "manager") && p.cards.length > 0;
				const canUse =
					!p.injuries.includes("arm") &&
					p.cards.some(
						(card) => card.availableRound <= s.round && (equipment(card.id).phases as readonly number[]).includes(4)
					);
				if (!canGive && !canUse) p.ready = true;
			}
			if (!s.players.every((p) => p.ready)) break;
			phase(s, "movement");
			continue;
		}
		if (s.phase === "movement") {
			advanceMovement(s);
			if (s.phase !== "movement") continue;
			break;
		}
		if (s.phase === "eruption") {
			execute(s, { action: "erupt" }, 0);
			continue;
		}
		break;
	}
}
// Provisional planning overwrites one bounded snapshot. Only a definitive
// action checkpoints it into replay history; it never truncates the public log.
function checkpointPlanning(s: State) {
	if (s.planningSnapshot) {
		s.history.push({ player: 0, move: { action: "$planning", snapshot: structuredClone(s.planningSnapshot) } });
		delete s.planningSnapshot;
	}
	delete s.liveUpdate;
}
function restorePlanning(s: State, snapshot: PlanningSnapshot) {
	s.players.forEach((p, i) => {
		p.path = [...snapshot.players[i]!.path];
		p.ready = snapshot.players[i]!.ready;
	});
	s.revision = snapshot.revision;
	s.planningSnapshot = structuredClone(snapshot);
	s.liveUpdate = true;
}
export function applyMove(data: State, input: unknown, seat: number): State {
	if (!Number.isInteger(seat) || seat < 0 || seat >= data.players.length) throw Error("Invalid player.");
	if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Invalid move.");
	const raw = input as Record<string, unknown>;
	if (typeof raw.action !== "string") throw Error("Invalid action.");
	const allowed = [
		"action",
		"keep",
		"drop",
		"path",
		"ids",
		"id",
		"target",
		"tiles",
		"face",
		"copy",
		"injury",
		"die",
		"count",
	];
	const move = Object.fromEntries(allowed.filter((k) => Object.hasOwn(raw, k)).map((k) => [k, raw[k]])) as Move;
	if (JSON.stringify(move).length > 3000) throw Error("Move is too large.");
	const s = structuredClone(data);
	execute(s, move, seat);
	advanceForcedActions(s);
	s.revision++;
	const live =
		data.phase === "planning" &&
		s.phase === "planning" &&
		s.round === data.round &&
		(move.action === "plan" || move.action === "ready");
	if (live) {
		s.liveUpdate = true;
		s.planningSnapshot = {
			players: s.players.map((p) => ({ path: [...p.path], ready: p.ready })),
			revision: s.revision,
		};
	} else {
		checkpointPlanning(s);
		s.history.push({ player: seat, move });
	}
	return s;
}
export function stripSecret(s: State, seat?: number): View {
	const {
		seed: _,
		counter: __,
		deck,
		history: ___,
		initOptions: ____,
		liveUpdate: _____,
		planningSnapshot: ______,
		...publicState
	} = structuredClone(s);
	const revealed = s.phase === "movement" || s.phase === "eruption" || s.phase === "ended";
	publicState.players.forEach((p, i) => {
		p.dice.forEach((d) => {
			if (!revealed && i !== seat && !p.radio && !d.aside) d.face = 0;
		});
	});
	publicState.ghost.forEach((d) => {
		if (!revealed && !s.ghostVisible.includes(d.id)) d.face = 0;
	});
	return { ...publicState, deckCount: deck.length };
}
export function activePlayers(s: State | View): number[] {
	if (s.outcome) return [];
	if (s.pending) return s.pending.players;
	const injured = s.players.flatMap((p, i) => (p.pendingInjuries ? [i] : []));
	if (injured.length) return injured;
	if (s.phase === "movement" && s.pendingHelpers?.length) return s.pendingHelpers;
	if (s.phase === "movement")
		return s.activeResolution === null
			? s.players.flatMap((p, i) => (p.resolved ? [] : [i]))
			: [
					s.activeResolution,
					...s.players.flatMap((p, i) =>
						i !== s.activeResolution && hasSkill(p, "gatherer") && p.powerBars > 0 ? [i] : []
					),
				];
	if (s.phase === "eruption") return [0];
	if (s.phase === "planning") return s.players.map((_, i) => i);
	return s.players.flatMap((p, i) => ((s.phase === "setup" ? p.setupDone : p.ready) ? [] : [i]));
}
export function dropGamePlayer(s: State, seat: number): State {
	if (!s.players[seat]) throw Error("Invalid player.");
	const next = structuredClone(s);
	checkpointPlanning(next);
	end(next, "lost", `${next.players[seat]!.name} left the expedition.`);
	next.revision++;
	next.history.push({ player: seat, move: { action: "$drop" } });
	return next;
}
export function setPlayerName(s: State, seat: number, name: string): State {
	if (!s.players[seat] || typeof name !== "string") throw Error("Invalid player metadata.");
	const next = structuredClone(s);
	checkpointPlanning(next);
	next.players[seat]!.name = name;
	next.history.push({ player: seat, move: { action: "$name", name } });
	return next;
}
export function replay(s: State, to?: number): State {
	let state = initGame(s.players.length, s.initOptions, s.seed);
	for (const e of s.history.slice(0, to ?? s.history.length)) {
		if (e.move.action === "$planning") {
			restorePlanning(state, e.move.snapshot as unknown as PlanningSnapshot);
			state.history.push(structuredClone(e));
			delete state.planningSnapshot;
		} else if (e.move.action === "$drop") state = dropGamePlayer(state, e.player);
		else if (e.move.action === "$name") state = setPlayerName(state, e.player, e.move.name as string);
		else state = applyMove(state, e.move, e.player);
	}
	if (to === undefined && s.planningSnapshot) restorePlanning(state, s.planningSnapshot);
	return state;
}
