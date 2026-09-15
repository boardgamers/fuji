import {
	applyMove,
	initGame,
	SKILLS,
	cell,
	paths,
	total,
	face,
	matches,
	terrain,
	type State,
	type Move,
} from "fuji-engine";
import type { TutorialOptions } from "@boardgamers/protocol/tutorial";

export const DESTINATION = "1,3";

export function firstStepsState(): State {
	let state = initGame(
		3,
		{
			skillAssignment: "fixed",
			skills: ["buddy", "scout", "manager"],
			difficulty: 1,
			scenario: 1,
			autoMovement: false,
			autoProgress: false,
		},
		"tutorial-first-steps"
	);
	for (let seat = 0; seat < 3; seat++) {
		const player = state.players[seat]!;
		if (!player.setupDone) {
			state = applyMove(
				state,
				{
					action: "setup",
					keep: player.cards.slice(0, SKILLS[player.skill].keep).map((c) => c.id),
					drop: SKILLS[player.skill].dice === 5 ? player.dice.at(-1)!.id : undefined,
				},
				seat
			);
		}
	}
	const target = cell(state, DESTINATION);
	const lookout = state.board.find((c) => c.terrain === 8)!;
	[lookout.terrain, target.terrain] = [target.terrain, lookout.terrain];
	// A prepared lesson, before the first learner action. All subsequent changes use applyMove.
	const rolls = [
		[6, 4, 2, 1, 3, 5],
		[4, 4, 2, 1, 1],
		[5, 1, 5, 1, 5, 3],
	];
	state.players.forEach((player, seat) => {
		player.name = ["You", "Mika", "Ren"][seat]!;
		player.dice.forEach((die, index) => {
			die.face = rolls[seat]![index]!;
		});
		state.deck.push(...player.cards.map((c) => c.id));
		player.cards = [];
	});
	state.log = [];
	state.history = [];
	return state;
}

export function lessonMove(state: State, move: Move): State {
	const phase = state.phase;
	let next = applyMove(state, move, 0);
	if (phase === "planning" && move.action === "ready") {
		for (const seat of [1, 2]) {
			const reserved = next.players.filter((p, i) => i !== seat && p.ready).map((p) => p.path.at(-1));
			const route = Object.values(paths(next, seat)).find(
				(p) => p.length >= 2 && p.length <= 3 && !reserved.includes(p.at(-1))
			);
			if (!route) throw Error("No scripted route is available.");
			next = applyMove(next, { action: "plan", path: route }, seat);
			next = applyMove(next, { action: "ready" }, seat);
		}
	}
	if (phase === "reroll" && next.players[0]!.ready) {
		const ren = next.players[2]!;
		const rule = terrain(cell(next, ren.path.at(-1)!).terrain).requirement;
		const weakDie = ren.dice.filter((d) => !matches(face(d), rule)).sort((a, b) => b.face - a.face)[0];
		if (!ren.ready && ren.rerolls > 0 && weakDie) {
			next = applyMove(next, { action: "reroll", ids: [weakDie.id] }, 2);
		}
		for (const seat of [1, 2]) {
			if (!next.players[seat]!.ready && next.phase === "reroll")
				next = applyMove(next, { action: "finishRerolls" }, seat);
		}
	}
	if (phase === "equipment" && move.action === "ready") {
		for (const seat of [1, 2]) next = applyMove(next, { action: "ready" }, seat);
	}
	if (phase === "movement" && next.players[0]!.resolved) {
		for (const seat of [1, 2]) next = applyMove(next, { action: "beginMovement" }, seat);
		if (next.phase === "eruption") next = applyMove(next, { action: "erupt" }, 0);
	}
	return next;
}

export function buddyChoices(state: State) {
	const player = state.players[0]!;
	const own = terrain(cell(state, DESTINATION).terrain).requirement;
	const teammate = terrain(cell(state, state.players[2]!.path.at(-1)!).terrain).requirement;
	const useful = player.dice.filter(
		(d) => !d.aside && !d.remove && !matches(face(d), own) && matches(face(d), teammate)
	);
	const best = Math.max(...useful.map((d) => d.face));
	return useful.filter((d) => d.face === best);
}

const only =
	(...actions: string[]) =>
	(_s: State, move: Move) =>
		actions.includes(move.action)
			? undefined
			: "Follow the highlighted action for this step. You can retry the step at any time.";

export const firstSteps: TutorialOptions<State, Move> = {
	game: "fuji",
	id: "first-steps",
	version: 2,
	initialState: firstStepsState,
	move: lessonMove,
	steps: [
		{
			id: "welcome",
			title: "Escape together",
			text: "Help everyone reach the village before the lava catches anyone. You control the gold explorer; Mika and Ren are scripted teammates. Preparation is done. Let’s plan your first move.",
			target: "board",
		},
		{
			id: "destination",
			title: "Choose Hilltop lookout",
			text: "Select the highlighted tile, one space to the right of your explorers. Its 2 · 4 · 6 symbols mean that only even-valued dice count here.",
			hint: "Click or tap Hilltop lookout on the map. Choosing a destination does not move your explorer yet.",
			target: `tile:${DESTINATION}`,
			complete: (s) => s.players[0]!.path.at(-1) === DESTINATION,
			validateMove: (s, m) =>
				only("plan")(s, m) ??
				(Array.isArray(m.path) && m.path.length === 2 && m.path.at(-1) === DESTINATION
					? undefined
					: "For this first journey, choose the highlighted Hilltop lookout."),
		},
		{
			id: "dice",
			title: "Count the matching dice",
			text: (s) =>
				`Your 6 + 4 + 2 give a total of ${total(s.players[0]!, 8)} here. The 1, 3 and 5 do not count. You will need a higher total than each neighbor on this same tile, even if they chose different destinations. Their dice stay hidden until movement.`,
			target: "dice",
			hint: "The viewer highlights matching dice and shows your total below them. Never share exact dice values or totals with teammates in a real game.",
		},
		{
			id: "confirm",
			title: "Confirm your destination",
			text: "Choose Ready to travel. A one- or two-space journey normally gives one reroll; three spaces give none. Mika and Ren will choose short routes to locations that fit their dice.",
			target: "confirm",
			complete: (s) => s.phase === "reroll",
			validateMove: only("ready"),
		},
		{
			id: "reroll",
			title: "Improve your dice",
			text: "Rerolling is a quiet phase: no discussion. Keep the even dice. Select one or more odd dice, then choose Reroll selected. Rolling several selected dice together spends just one reroll.",
			target: "dice",
			hint: "Select the 1, 3 and/or 5 below the map, then press Reroll selected.",
			complete: (s) => s.players[0]!.rerolls === 0,
			validateMove: (s, m) =>
				only("reroll")(s, m) ??
				(Array.isArray(m.ids) &&
				m.ids.length &&
				m.ids.every((id) => s.players[0]!.dice.some((d) => d.id === id && d.face % 2 === 1))
					? undefined
					: "Keep your matching even dice. Select at least one odd die to reroll."),
		},
		{
			id: "buddy",
			title: "Help Ren with Buddy",
			text: (s) => {
				const die = buddyChoices(s)[0]!;
				return `Your ${face(die).color} ${die.face} does not help at Hilltop lookout, but adds ${die.face} to the total Ren must beat. Select it, then choose Set selected die aside. Buddy makes it public and excludes it from all comparisons until next round, without spending a reroll.`;
			},
			hint: "The blue 3 below this die marks Ren's destination. Keep your even dice. Setting this die aside leaves your own total unchanged; with no rerolls remaining, your dice choices are then finished.",
			target: (s) => `die:${buddyChoices(s)[0]!.id}`,
			complete: (s) => s.players[0]!.buddyUsed && s.phase === "equipment",
			validateMove: (s, m) => {
				const ids = m.ids;
				return (
					only("buddy")(s, m) ??
					(Array.isArray(ids) && ids.length === 1 && buddyChoices(s).some((d) => d.id === ids[0])
						? undefined
						: "Set aside the highlighted 5 to help Ren without reducing your own total.")
				);
			},
		},
		{
			id: "equipment",
			title: "Ready for the reveal",
			text: "Ren used a reroll to improve a non-matching die; Mika kept strong dice for Flooded forest. You may talk again and use equipment. This chapter starts with empty packs, so choose Ready to reveal. The remaining dice are revealed when everyone is ready.",
			target: "confirm",
			complete: (s) => s.phase === "movement",
			validateMove: only("ready"),
		},
		{
			id: "move",
			title: "Compare and move",
			text: (s) =>
				`For Hilltop lookout, your total is ${total(s.players[0]!, 8)}, Mika's is ${total(s.players[1]!, 8)} and Ren's is ${total(s.players[2]!, 8)}. Yours is higher than both. Resolve your journey using the highlighted button, then watch Mika and Ren move and the lava spread.`,
			target: "resolve",
			complete: (s) => s.round > 1,
			validateMove: only("beginMovement"),
		},
	],
	completion: {
		title: "Your first journey",
		text: (s) => {
			const result = s.log
				.slice()
				.reverse()
				.find((e) => e.journey?.name === "You")?.journey;
			return `You reached Hilltop lookout! Your lead was ${(result?.own ?? 0) - (result?.highest ?? 0)} and you lost ${result?.loss ?? 0} stamina. A small lead costs more stamina; a tie or lower means you stay put. The journal records the comparison. Mika and Ren have also resolved their journeys, and the lava has spread. A new round is ready.`;
		},
		target: "journal",
		hint: "The whole team must escape. Keep an eye on teammates' destinations as well as your own. Every round ends with lava spreading after everyone has resolved their journey.",
	},
};
