import type { AchievementDefinition, AchievementManifest, SeatAchievements } from "@boardgamers/protocol/engine";
import { EXHAUSTION } from "./data.js";
import type { State } from "./types.js";

type Feat = AchievementDefinition & { qualifies: (state: State) => boolean };
const feats: Feat[] = [
	{ id: "escape-together", name: "Escape Together", description: "Win an expedition together.", qualifies: () => true },
	...Array.from(
		{ length: 7 },
		(_, i): Feat => ({
			id: `scenario-${i + 1}-escape`,
			name: `Scenario ${i + 1} Escape`,
			description: `Win scenario ${i + 1} at any difficulty.`,
			qualifies: (s) => s.scenario === i + 1,
		})
	),
	...Array.from(
		{ length: 3 },
		(_, i): Feat => ({
			id: `difficulty-${i + 2}-escape`,
			name: `Difficulty ${i + 2} Escape`,
			description: `Win at difficulty ${i + 2}${i < 2 ? " or higher" : ""}.`,
			qualifies: (s) => s.difficulty >= i + 2,
		})
	),
	{
		id: "strength-to-spare",
		name: "Strength to Spare",
		description: "Win with every explorer having at least 11 stamina remaining.",
		qualifies: (s) => s.players.every((p) => EXHAUSTION - p.stamina >= 11),
	},
	{
		id: "unscathed-team",
		name: "Unscathed Team",
		description: "Win with no explorer having an injury or an injury awaiting selection.",
		qualifies: (s) => s.players.every((p) => p.injuries.length === 0 && p.pendingInjuries === 0),
	},
	{
		id: "narrow-escape",
		name: "Narrow Escape",
		description: "Win with at least one explorer having 5 or less stamina remaining.",
		qualifies: (s) => s.players.some((p) => EXHAUSTION - p.stamina <= 5),
	},
	{
		id: "well-equipped",
		name: "Well Equipped",
		description: "Win with every explorer still carrying at least one equipment card.",
		qualifies: (s) => s.players.every((p) => p.cards.length > 0),
	},
	{
		id: "four-to-safety",
		name: "Four to Safety",
		description: "Win as a team of four explorers.",
		qualifies: (s) => s.players.length === 4,
	},
];

export function achievementDefinitions(): AchievementManifest {
	return { revision: 1, achievements: feats.map(({ qualifies: _, ...definition }) => ({ ...definition })) };
}

/** Only authoritative final state is inspected; never infer feats from private rolls or log prose.
 * BGS owns account eligibility (humans, bots, cancellations and dropped seats).
 */
export function achievements(s: State): SeatAchievements[] {
	if (s.phase !== "ended" || (s.outcome !== "won" && s.outcome !== "lost")) return [];
	if (["tutorial", "practice", "analysis"].some((flag) => s.initOptions[flag] === true)) return [];
	const outcome = s.outcome === "won" ? "win" : "loss";
	const earned = outcome === "win" ? feats.filter((feat) => feat.qualifies(s)).map((feat) => feat.id) : [];
	return s.players.map((_, seat) => ({ seat, earned: [...earned], outcome }));
}
