import { applyMove, cell, terrain, threatened, total, type State, type Move, type EquipmentId } from "fuji-engine";
import type { TutorialOptions } from "@boardgamers/protocol/tutorial";
import { firstSteps, firstStepsState, lessonMove, DESTINATION } from "./first-steps.ts";

const only =
	(...actions: string[]) =>
	(_state: State, move: Move) =>
		actions.includes(move.action) ? undefined : "Follow this step's highlighted action. Use Replay step to try again.";

function setTerrain(state: State, id: string, type: number) {
	const target = cell(state, id);
	const source = state.board.find((c) => c.terrain === type)!;
	if (terrain(source.terrain).kind !== terrain(target.terrain).kind)
		throw Error("Tutorial swaps must preserve location kinds.");
	[source.terrain, target.terrain] = [target.terrain, source.terrain];
}

function giveCards(state: State, cards: EquipmentId[]) {
	state.deck = state.deck.filter((id) => !cards.includes(id));
	state.players[0]!.cards = cards.map((id) => ({ id, used: 0, availableRound: state.round }));
}

function equipmentPosition(state: State, routes: string[][]) {
	for (let seat = 0; seat < routes.length; seat++) {
		state = applyMove(state, { action: "plan", path: routes[seat] }, seat);
		state = applyMove(state, { action: "ready" }, seat);
	}
	for (let seat = 0; seat < routes.length; seat++) {
		if (state.phase === "reroll" && !state.players[seat]!.ready)
			state = applyMove(state, { action: "finishRerolls" }, seat);
	}
	return state;
}

function equipmentState() {
	const state = firstStepsState();
	giveCards(state, ["shovel", "map"]);
	return equipmentPosition(state, [
		["0,3", DESTINATION],
		["0,3", "1,3", "1,2"],
		["0,3", "1,3", "1,4"],
	]);
}

export const equipmentLesson: TutorialOptions<State, Move> = {
	game: "fuji",
	id: "equipment",
	version: 2,
	initialState: equipmentState,
	move: lessonMove,
	steps: [
		{
			id: "packs",
			title: "Make your equipment count",
			text: "Routes and rerolls are finished. Your pack holds a Shovel and a Map, both usable during the equipment phase. Open cards to inspect their effect and timing. Most equipment is discarded after one use; the Tinkerer skill is an exception.",
			target: "equipment",
		},
		{
			id: "shovel",
			title: "Turn a die with the Shovel",
			text: "Open Shovel, select your yellow 1 below the map, choose 6 under New value, then Use Shovel. Your destination counts even values: this turns a useless die into six more points.",
			hint: "Choose the fourth die from the left (yellow 1). The face picker shows all six possible faces, including their colors.",
			target: "equipment:shovel",
			complete: (s) => s.players[0]!.dice.find((d) => d.id === "0-3")?.face === 6 && s.discard.includes("shovel"),
			validateMove: (_s, m) =>
				m.action === "equipment" &&
				m.id === "shovel" &&
				m.face === 6 &&
				Array.isArray(m.ids) &&
				m.ids.length === 1 &&
				m.ids[0] === "0-3"
					? undefined
					: "Use the Shovel to turn the yellow 1 into a 6.",
		},
		{
			id: "map",
			title: "Lend a die with the Map",
			text: "Your blue 5 does not count at your even-valued destination, but it counts at Ren's. Open Map, select that 5, choose Ren and Use Map. Lending it both helps Ren and removes it from the total Ren must beat.",
			hint: "The blue 5 is the last die. A Map loan lasts until the end of the round. Only the sender and recipient see the lent face before the reveal; other players see that a die was lent.",
			target: "equipment:map",
			complete: (s) => s.players[2]!.dice.some((d) => d.id === "0-5") && s.discard.includes("map"),
			validateMove: (_s, m) =>
				m.action === "equipment" &&
				m.id === "map" &&
				m.target === 2 &&
				Array.isArray(m.ids) &&
				m.ids.length === 1 &&
				m.ids[0] === "0-5"
					? undefined
					: "Lend your blue 5 to Ren using the Map.",
		},
		{
			id: "reveal",
			title: "Reveal when everyone is ready",
			text: "The Shovel and Map are now discarded. Your matching total is 18, and Ren has the borrowed die. Choose Ready to reveal. Using equipment can change the team's choices, so everyone confirms again afterward.",
			target: "confirm",
			complete: (s) => s.phase === "movement",
			validateMove: only("ready"),
		},
		{
			id: "move",
			title: "Put the improved dice to work",
			text: "Your improved even dice beat both neighbors at Hilltop lookout. Resolve your journey, then watch your teammates move and the lava spread.",
			target: "resolve",
			complete: (s) => s.round > 1,
			validateMove: only("beginMovement"),
		},
	],
	completion: {
		title: "Equipment helps the whole team",
		hint: "Torch works during planning; Shovel and Map during equipment. An arm injury prevents equipment use.",
		text: "You moved without losing stamina, and your loan helped Ren move. The lava has spread and your die has returned. Equipment can help you or a teammate; check when each card can be used.",
		target: "journal",
	},
};

export const BONUS_TILE = "1,3";
function bonusState() {
	const state = firstStepsState();
	setTerrain(state, BONUS_TILE, 10);
	const marker = state.board.find((c) => c.equipment)!;
	marker.equipment = false;
	cell(state, BONUS_TILE).equipment = true;
	state.players[0]!.skill = "manager";
	const rolls = [
		[1, 2, 2, 1, 6, 6],
		[4, 4, 4, 6, 6],
		[5, 5, 5, 5, 5, 5],
	];
	state.players.forEach((player, seat) =>
		player.dice.forEach((die, index) => {
			die.face = rolls[seat]![index]!;
		})
	);
	state.deck = ["rope", ...state.deck.filter((id) => id !== "rope")];
	return state;
}

export const terrainLesson: TutorialOptions<State, Move> = {
	game: "fuji",
	id: "terrain-bonuses",
	version: 2,
	initialState: bonusState,
	move: lessonMove,
	steps: [
		{
			id: "destination",
			title: "Read the location's symbols",
			text: "Choose Hidden passage, one space to the right. Only 1s and 2s count here. Its circular arrow grants one extra reroll when you choose it as your destination. The equipment token is a separate reward for finishing your movement here.",
			hint: "Look for the arrow symbol, not just the numbers: not every location with low values gives an extra reroll. Passing through a location does not grant its destination bonus.",
			target: `tile:${BONUS_TILE}`,
			complete: (s) => s.players[0]!.path.at(-1) === BONUS_TILE,
			validateMove: (_s, m) =>
				m.action === "plan" && Array.isArray(m.path) && m.path.length === 2 && m.path.at(-1) === BONUS_TILE
					? undefined
					: "Choose the highlighted Hidden passage, one space away.",
		},
		{
			id: "confirm",
			title: "One normal reroll, plus one bonus",
			text: "Confirm Ready to travel. This one-space route gives one normal reroll, plus one for the destination's arrow: two in total. The bonus is available before you move, not after landing.",
			target: "confirm",
			complete: (s) => s.phase === "reroll" && s.players[0]!.rerolls === 2,
			validateMove: only("ready"),
		},
		{
			id: "first-roll",
			title: "Spend the first reroll",
			text: "Keep the four matching dice (1, 2, 2, 1). Select both 6s (dice 5 and 6) and reroll them together. This spends one reroll, leaving one more.",
			target: "dice",
			complete: (s) => s.players[0]!.rerolls === 1,
			validateMove: (_s, m) =>
				m.action === "reroll" &&
				Array.isArray(m.ids) &&
				m.ids.length === 2 &&
				m.ids.includes("0-4") &&
				m.ids.includes("0-5")
					? undefined
					: "Select both 6s (dice 5 and 6), keeping the four matching dice.",
		},
		{
			id: "bonus-roll",
			title: "Use the extra chance",
			text: (s) =>
				`The last die is now a matching 1: keep it. The fifth die shows ${s.players[0]!.dice[4]!.face}, which does not count here. Reroll just that fifth die using your bonus chance.`,
			target: "die:0-4",
			complete: (s) => s.phase === "equipment",
			validateMove: (_s, m) =>
				m.action === "reroll" && Array.isArray(m.ids) && m.ids.length === 1 && m.ids[0] === "0-4"
					? undefined
					: "Keep the new 1. Use your second reroll on the fifth die.",
		},
		{
			id: "reveal",
			title: "The token is still on the board",
			text: "You have used the bonus, but have not moved or collected equipment yet. Your pack is empty. Choose Ready to reveal, then compare dice as usual.",
			target: "confirm",
			complete: (s) => s.phase === "movement",
			validateMove: only("ready"),
		},
		{
			id: "arrive",
			title: "Finish here to collect equipment",
			text: (s) =>
				`Your matching total is ${total(s.players[0]!, 10)}, higher than both neighbors. Resolve your journey to land on the equipment token. Passing over it would not collect it.`,
			target: "resolve",
			complete: (s) => s.players[0]!.position === BONUS_TILE && !cell(s, BONUS_TILE).equipment,
			validateMove: only("beginMovement"),
		},
	],
	completion: {
		title: "Your Rope is ready",
		text: "You collected a Rope on arrival. It becomes usable next round, which has now begun. The equipment token is gone; the printed reroll arrow can help again on a later visit.",
		target: "equipment:rope",
	},
};

export const ERUPTION_TILE = "5,2";
export function lavaState() {
	let state = firstStepsState();
	state.players.forEach((p) => {
		p.position = "3,2";
		p.path = [p.position];
	});
	// A later-round checkpoint: advance the prepared lava front by three normal waves.
	for (let wave = 0; wave < 3; wave++) {
		const next = threatened(state);
		for (const c of state.board) if (next.includes(c.id)) c.lava = true;
	}
	setTerrain(state, ERUPTION_TILE, 8);
	setTerrain(state, "3,2", 19);
	const rolls = [
		[6, 6, 6, 1, 1, 1],
		[5, 5, 5, 5, 5],
		[5, 5, 5, 5, 5, 5],
	];
	state.players.forEach((player, seat) =>
		player.dice.forEach((die, index) => {
			die.face = rolls[seat]![index]!;
		})
	);
	state = equipmentPosition(state, [["3,2", "4,2", ERUPTION_TILE], ["3,2"], ["3,2", "4,2"]]);
	for (const seat of [1, 2]) state = applyMove(state, { action: "ready" }, seat);
	state.initOptions.autoMovement = true;
	state.initOptions.autoProgress = true;
	state.round = 4;
	return state;
}

export const lavaLesson: TutorialOptions<State, Move> = {
	game: "fuji",
	id: "lava",
	version: 5,
	initialState: lavaState,
	move: (state, move) => applyMove(state, move, 0),
	steps: [
		{
			id: "warning",
			title: "A deliberately unsafe plan",
			text: "This plan ends in defeat. Mika stays put while your route crosses an eruption marker. Its extra wave, followed by the normal eruption, will catch Mika.",
			hint: "Markers trigger once when entered or crossed. Check every teammate's position against both waves.",
			target: `tile:${ERUPTION_TILE}`,
		},
		{
			id: "reveal",
			title: "Watch the two waves",
			text: "Choose Ready to reveal and watch both eruptions. The game chooses movement order automatically.",
			target: "confirm",
			complete: (s) => s.outcome === "lost",
			validateMove: only("ready"),
		},
	],
	completion: {
		title: "One explorer caught, the whole team loses",
		text: "Mika survived the extra wave, but the normal eruption caught her. Remember to plan for both waves.",
		target: "board",
	},
};

export const WIN_DESTINATION = "4,1";
export function winState() {
	let state = firstStepsState();
	state.round = 5;
	state.initOptions.autoMovement = true;
	state.initOptions.autoProgress = false;
	// Use the garden as one of this prepared map's five village tiles.
	cell(state, "4,0").terrain = 31;
	for (let wave = 0; wave < 4; wave++) {
		const next = threatened(state);
		for (const c of state.board) if (next.includes(c.id)) c.lava = true;
	}
	state.players.forEach((player, seat) => {
		player.position = "3,2";
		player.path = [player.position];
		player.dice.forEach((die) => {
			die.face = [6, 1, 5][seat]!;
		});
	});
	for (const [seat, path] of [
		[1, ["3,2", "4,2", "4,1", "4,0"]],
		[2, ["3,2", "4,2"]],
	] as const) {
		state = applyMove(state, { action: "plan", path: [...path] }, seat);
		state = applyMove(state, { action: "ready" }, seat);
	}
	return state;
}

function winMove(state: State, move: Move) {
	let next = applyMove(state, move, 0);
	for (const seat of [1, 2]) {
		if (next.phase === "reroll" && !next.players[seat]!.ready) {
			next = applyMove(next, { action: "finishRerolls" }, seat);
		}
		if (state.phase === "equipment" && next.phase === "equipment" && !next.players[seat]!.ready) {
			next = applyMove(next, { action: "ready" }, seat);
		}
	}
	return next;
}

export const winLesson: TutorialOptions<State, Move> = {
	game: "fuji",
	id: "village",
	version: 1,
	initialState: winState,
	move: winMove,
	steps: [
		{
			id: "welcome",
			title: "One last journey",
			text: "The lava is close and the village is within reach. Mika has chosen Village garden and Ren has chosen Blossom square. Help all three explorers get to safety. Reaching the village alone does not win the game.",
			target: "board",
		},
		{
			id: "destination",
			title: "Choose Village street",
			text: "Choose the highlighted Village street, two spaces away. It counts 4s and 6s, so your six 6s are a strong match. Each explorer must choose a different destination.",
			target: `tile:${WIN_DESTINATION}`,
			complete: (s) => s.players[0]!.path.at(-1) === WIN_DESTINATION,
			validateMove: (_s, m) =>
				m.action === "plan" && Array.isArray(m.path) && m.path.length === 3 && m.path.at(-1) === WIN_DESTINATION
					? undefined
					: "Choose Village street via Blossom square.",
		},
		{
			id: "confirm",
			title: "Confirm your destination",
			text: "Mika and Ren are ready. Confirm your route to begin the dice phase.",
			target: "confirm",
			complete: (s) => s.phase === "reroll",
			validateMove: only("ready"),
		},
		{
			id: "keep",
			title: "Keep these strong dice",
			text: "All your dice count at Village street. Keep them and finish rerolling. Your teammates keep the dice that suit their own destinations.",
			target: "finish-rerolls",
			complete: (s) => s.phase === "equipment",
			validateMove: only("finishRerolls"),
		},
		{
			id: "escape",
			title: "Bring everyone home",
			text: "Choose Ready to reveal. The game compares the dice and moves everyone in order. Watch all three explorers enter the village.",
			target: "confirm",
			complete: (s) => s.outcome === "won",
			validateMove: only("ready"),
		},
	],
	completion: {
		title: "Everyone escaped!",
		text: "You, Mika and Ren all reached the village. The whole team wins immediately, before another eruption. That is the goal: bring everyone home together.",
		target: "board",
	},
};

export const lessons = [firstSteps, equipmentLesson, terrainLesson, lavaLesson, winLesson];
