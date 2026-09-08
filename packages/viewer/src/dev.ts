import { mount } from "svelte";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import {
	initGame,
	applyMove,
	stripSecret,
	activePlayers,
	paths,
	terrain,
	cell,
	total,
	SKILLS,
	hasSkill,
	activeDice,
	face,
	matches,
	type State,
	type Move,
} from "fuji-engine";
import "./lib/theme.css";
const store = new Store();
store.local = true;
store.seat = 0;
let game: State;
const saved = localStorage.getItem("fuji-dev-v1");
try {
	game = saved ? JSON.parse(saved) : initGame(3, {}, "first-light");
	if (game.schemaVersion !== 1) throw Error("Old save");
} catch {
	game = initGame(3, {}, "first-light");
}
function publish() {
	localStorage.setItem("fuji-dev-v1", JSON.stringify(game));
	store.receive(stripSecret(game, store.seat));
}
store.send = (move) => {
	game = applyMove(game, move, store.seat!);
	publish();
};
store.selectSeat = (seat) => {
	store.seat = seat;
	store.error = "";
	publish();
};
store.restart = (players, seed, difficulty) => {
	game = initGame(players, { difficulty }, seed);
	store.seat = 0;
	publish();
};
function chooseMove(seat: number): Move {
	const p = game.players[seat]!;
	if (game.pending) {
		if (game.pending.kind === "lend") return { action: "decline" };
		return { action: "respond", ids: [activeDice(p)[0]!.id] };
	}
	if (p.pendingInjuries) {
		const injury = ["arm", "eye", "amnesia", "leg"].find((i) => !p.injuries.includes(i as never))!;
		return { action: "injury", injury, die: p.dice.find((d) => d.owner === seat && !d.aside)?.id };
	}
	if (game.phase === "setup")
		return { action: "setup", keep: p.cards.slice(0, SKILLS[p.skill].keep).map((c) => c.id), drop: p.dice.at(-1)?.id };
	if (game.phase === "planning") {
		const choices = Object.values(paths(game, seat)).filter(
			(path) => !game.players.some((q, i) => i !== seat && q.ready && q.path.at(-1) === path.at(-1))
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
		if (game.activeResolution === null) return { action: "beginMovement" };
		if (game.activeResolution === seat) return { action: "resolve" };
		return { action: "bar" };
	}
	return { action: "erupt" };
}
store.teammateStep = () => {
	try {
		const available = activePlayers(game).filter(
			(i) => !["planning", "equipment"].includes(game.phase) || !game.players[i]!.ready
		);
		const seat = available.find((i) => i !== store.seat) ?? available[0];
		if (seat === undefined) return;
		game = applyMove(game, chooseMove(seat), seat);
		publish();
	} catch (e) {
		store.error = String(e);
	}
};
publish();
mount(App, { target: document.querySelector("#app")!, props: { store } });
