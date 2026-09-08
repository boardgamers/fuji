import type { EquipmentId, Skill, Injury, Color } from "./data.js";
export type Phase = "setup" | "planning" | "reroll" | "equipment" | "movement" | "eruption" | "ended";
export interface Die {
	id: string;
	type: number;
	owner: number;
	face: number;
	aside: boolean;
	remove: boolean;
}
export interface Card {
	id: EquipmentId;
	used: number;
	availableRound: number;
}
export interface Player {
	name: string;
	character: number;
	skill: Skill;
	position: string;
	path: string[];
	dice: Die[];
	cards: Card[];
	stamina: number;
	injuries: Injury[];
	pendingInjuries: number;
	ready: boolean;
	rerolls: number;
	powerBars: number;
	radio: boolean;
	aid: boolean;
	bonus: number;
	resolved: boolean;
	setupDone: boolean;
	buddyUsed: boolean;
}
export interface Cell {
	id: string;
	x: number;
	y: number;
	terrain: number;
	lava: boolean;
	equipment: boolean;
	eruption: number;
}
export interface Event {
	round: number;
	text: string;
	type: "phase" | "move" | "equipment" | "eruption" | "injury" | "end";
}
export interface Pending {
	kind: "reroll" | "lend";
	players: number[];
	remaining: number;
	required: boolean;
	receiver?: number;
}
export interface PlanningSnapshot {
	players: { path: string[]; ready: boolean }[];
	revision: number;
}
export interface State {
	liveUpdate?: boolean;
	planningSnapshot?: PlanningSnapshot;
	schemaVersion: 1;
	seed: string;
	counter: number;
	round: number;
	phase: Phase;
	players: Player[];
	board: Cell[];
	deck: EquipmentId[];
	discard: EquipmentId[];
	difficulty: number;
	log: Event[];
	revision: number;
	outcome: null | "won" | "lost";
	reason: string;
	activeResolution: number | null;
	pending: Pending | null;
	ghost: Die[];
	ghostVisible: string[];
	history: { player: number; move: Record<string, unknown> }[];
	initOptions: Record<string, unknown>;
}
export interface View extends Omit<
	State,
	"seed" | "counter" | "deck" | "history" | "initOptions" | "liveUpdate" | "planningSnapshot"
> {
	deckCount: number;
}
export interface Move {
	action: string;
	[key: string]: unknown;
}
export interface ResolvedFace {
	value: number;
	color: Color;
}
