export type Color = "blue" | "pink" | "yellow";
export type Face = { value: number; color: Color };
export const DICE: readonly (readonly Color[])[] = [
	["blue", "yellow", "pink", "pink", "yellow", "blue"],
	["yellow", "pink", "blue", "blue", "pink", "yellow"],
	["pink", "blue", "yellow", "yellow", "blue", "pink"],
];
export type Requirement = { colors?: Color[]; values?: number[]; parity?: "odd" | "even"; combine?: "or" };
export type Terrain = {
	id: number;
	name: string;
	kind: "land" | "village" | "rubble" | "volcano";
	requirement: Requirement;
	reroll: boolean;
};
const t = (
	id: number,
	name: string,
	requirement: Requirement,
	reroll = false,
	kind: Terrain["kind"] = "land"
): Terrain => ({ id, name, requirement, reroll, kind });
export const TERRAINS: Terrain[] = [
	t(1, "Mount Fuji", {}, false, "volcano"),
	t(2, "Upper scree", {}, false, "rubble"),
	t(3, "Lower scree", {}, false, "rubble"),
	t(4, "Lake temple", { colors: ["yellow"], values: [6], combine: "or" }),
	t(5, "Sunlit shrine", { values: [1, 3] }, true),
	t(6, "Flooded forest", { values: [2, 4] }),
	t(7, "Forest cabin", { colors: ["pink"], parity: "odd" }),
	t(8, "Hilltop lookout", { parity: "even" }),
	t(9, "Red bridge", { colors: ["yellow"], parity: "even" }),
	t(10, "Hidden passage", { values: [1, 2] }, true),
	t(11, "Lakeside gate", { colors: ["yellow"], values: [4], combine: "or" }),
	t(12, "Leaning shelter", { colors: ["pink"], values: [5], combine: "or" }),
	t(13, "Bamboo grove", { colors: ["blue"], parity: "odd" }),
	t(14, "Shrine steps", { colors: ["pink", "blue"], parity: "odd" }),
	t(15, "Forest waterfall", { colors: ["blue"], values: [1, 2, 3] }, true),
	t(16, "Wooden crossing", { colors: ["pink", "blue", "yellow"] }),
	t(17, "Sunken trail", { values: [3, 6] }),
	t(18, "Riverside pavilion", { colors: ["yellow"], values: [1, 2, 3] }, true),
	t(19, "Mountain staircase", { parity: "odd" }),
	t(20, "Golden gate", { colors: ["yellow"], parity: "odd" }),
	t(21, "Bamboo path", { colors: ["pink", "blue"] }),
	t(22, "Lakeside shelter", { colors: ["blue"], values: [6], combine: "or" }),
	t(23, "Sunlit hillside", { colors: ["pink"], values: [1, 2, 3] }, true),
	t(24, "Forest sanctuary", { colors: ["pink", "blue"], parity: "even" }),
	t(25, "River bend", { colors: ["yellow", "blue"] }),
	t(26, "Riverside house", { colors: ["pink"], values: [4], combine: "or" }),
	t(27, "Stone path", { values: [3, 5] }),
	t(28, "Village pagoda", { colors: ["pink"], parity: "even" }, false, "village"),
	t(29, "Blossom square", { colors: ["blue"], values: [5], combine: "or" }, false, "village"),
	t(30, "Village gate", { colors: ["yellow", "pink"] }, false, "village"),
	t(31, "Village garden", { values: [1, 2, 3] }, true, "village"),
	t(32, "Village bridge", { colors: ["blue"], parity: "even" }, false, "village"),
	t(33, "Village street", { values: [4, 6] }, false, "village"),
];
export const terrain = (id: number): Terrain => {
	const out = TERRAINS.find((t) => t.id === id);
	if (!out) throw Error("Unknown terrain");
	return out;
};
export function matches(face: Face, r: Requirement): boolean {
	const c = !r.colors || r.colors.includes(face.color);
	const v = !r.values || r.values.includes(face.value);
	const p = !r.parity || face.value % 2 === (r.parity === "odd" ? 1 : 0);
	return face.value > 0 && (r.combine === "or" ? c || v : c && v && p);
}
export function requirementLabel(r: Requirement): string {
	const colors = r.colors?.length === 3 ? null : r.colors?.join(" or ");
	const values = r.values?.join(", ");
	if (r.combine === "or") return `${colors} or ${values}`;
	return [colors, r.parity, values].filter(Boolean).join(" · ") || "all dice";
}
export const SKILLS = {
	manager: {
		name: "Equipment manager",
		dice: 6,
		draw: 4,
		keep: 2,
		page: 1,
		description: "Give your equipment to any teammate, even from a different location.",
	},
	survivalist: {
		name: "Survivalist",
		dice: 5,
		draw: 1,
		keep: 1,
		page: 2,
		description: "One additional reroll during the reroll phase.",
	},
	gatherer: {
		name: "Gatherer",
		dice: 6,
		draw: 1,
		keep: 1,
		page: 3,
		description: "Forfeit a reroll to collect a power bar. Spend it during a movement turn for +1.",
	},
	buddy: {
		name: "Buddy",
		dice: 6,
		draw: 1,
		keep: 1,
		page: 4,
		description: "Set aside one die during rerolls. Everyone can see it; it returns after this round.",
	},
	scout: {
		name: "Scout",
		dice: 5,
		draw: 2,
		keep: 2,
		page: 5,
		description: "Travel up to four spaces. A four-space journey allows no phase-three rerolls.",
	},
	tinkerer: {
		name: "Tinkerer",
		dice: 5,
		draw: 3,
		keep: 1,
		page: 6,
		description: "Use each equipment card twice. Discard it after its second use.",
	},
} as const;
export type Skill = keyof typeof SKILLS;
export const EQUIPMENT = [
	{ id: "binoculars", name: "Binoculars", phases: [2], description: "Swap two empty land tiles." },
	{
		id: "flare",
		name: "Flare gun",
		phases: [4],
		description: "+3 to your movement value during your turn this round.",
	},
	{ id: "rope", name: "Rope", phases: [2, 4], description: "Move immediately to an adjacent land tile." },
	{ id: "shovel", name: "Shovel", phases: [4], description: "Turn one of your dice to any face." },
	{ id: "torch", name: "Torch", phases: [2], description: "Reroll any of your dice once." },
	{
		id: "knife",
		name: "Pocketknife",
		phases: [2, 4],
		description: "Copy an equipment card belonging to another player.",
	},
	{ id: "water", name: "Water flask", phases: [4], description: "Take up to two rerolls, or grant one to a teammate." },
	{
		id: "aid",
		name: "First aid kit",
		phases: [4],
		description: "Lose no stamina this round. You must still qualify to move.",
	},
	{ id: "radio", name: "Wireless", phases: [2, 4], description: "Reveal your dice until the end of this phase." },
	{ id: "tape", name: "Tape", phases: [4], description: "Turn any of your ones to sixes." },
	{
		id: "machete",
		name: "Machete",
		phases: [4],
		description:
			"Set aside one or two dice. They are visible to everyone and do not count in movement comparisons. They return at the end of the round.",
	},
	{
		id: "lighter",
		name: "Fire lighter",
		phases: [4],
		description: "Ask a teammate to lend you one die for this round.",
	},
	{ id: "carabiner", name: "Carabiner", phases: [4], description: "Every player must reroll exactly one die." },
	{ id: "compass", name: "Compass", phases: [4], description: "Turn any of your sixes to ones." },
	{ id: "map", name: "Map", phases: [4], description: "Lend one die to a teammate until the end of this round." },
] as const;
export type EquipmentId = (typeof EQUIPMENT)[number]["id"];
export const equipment = (id: EquipmentId) => EQUIPMENT.find((c) => c.id === id)!;
export const INJURIES = ["leg", "arm", "eye", "amnesia"] as const;
export type Injury = (typeof INJURIES)[number];
export const INJURY_AT = [5, 10, 15, 20];
export const EXHAUSTION = 25;
export const CHARACTERS = ["Mr Iain Jones", "Lady Livingstone", "Hiromi", "Kurt von Krach"];
export const CHARACTER_COLORS = ["#dcb986", "#8acd90", "#88c6df", "#da9bde"];
// Coordinates transcribed from scenario card 1. V4 is present only with four players.
export const SCENARIO_ONE = [
	["V", " ", " ", " ", "v", "v", "v", "V4"],
	["R", " ", " ", " ", "vE", " ", " ", " "],
	["R", "S4", "E", "L", "v", "X", "E", " "],
	["S", "L", " ", "L", " ", "L", " ", " "],
	[" ", "L", "L", "L", "X", "L", "E", " "],
	[" ", "E", " ", " ", "L", " ", "L", " "],
	[" ", " ", " ", " ", "E", "L", "E", " "],
];

// Production scenario cards 2–7. S/S4: white/grey starts; vX: village eruption.
// Grey starts remain ordinary land at every player count; only V4 is omitted.
export const SCENARIOS = [
	SCENARIO_ONE,
	[
		". . . . L E L .",
		". . . . E . L .",
		". L L L L X E .",
		"E S4 L . . L . V4",
		". S . . E L . v",
		"R R . . . L . v",
		"V . . E L L vX v",
		". . . . . E . v",
	],
	[
		"L L E . E L E L",
		"S . L . L . . E",
		"S4 L L L X L L X",
		"R . L E . L . vE",
		"R . . . . E . v",
		"V . . . . . . v",
		". . . . . V4 v v",
	],
	[
		". . . . E . . .",
		". . E L L L vX vE",
		"V . . . L . . v",
		"R . E L L E . v",
		"R . . . X . . v",
		"S S4 L L L . . V4",
		". L E . E . . .",
	],
	[
		". . L E L . V .",
		". . E . L . R .",
		". . L E L S R .",
		"V4 . L . . L S4 .",
		"v . E . . L . .",
		"v . X L L L L E",
		"v . L . . . E .",
		"vX v L E . . . .",
	],
	[
		". . . E . . . .",
		"R S S4 L . E L E",
		"R . L L . L . L",
		"V . . L X L L E",
		". . . E . E L .",
		". . . . . . L E",
		". V4 v v v v vX .",
	],
	[
		". . E . . . E .",
		". L L . . E L .",
		"E L L L X L L E",
		". vX . . . L E .",
		"v v . . . L . .",
		"v . . V . S4 E .",
		"v V4 . R R S . .",
	],
].map((rows) => rows.map((row) => (typeof row === "string" ? row.split(" ").map((c) => (c === "." ? " " : c)) : row)));
