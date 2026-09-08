import { mount } from "svelte";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import { initGame, applyMove, moveAI, stripSecret, activePlayers, type State } from "fuji-engine";
import "./lib/theme.css";
import enginePackage from "../../engine/package.json";
const store = new Store();
store.local = true;
store.setSound(localStorage.getItem("fuji-sound") !== "false");
store.colorblind = localStorage.getItem("fuji-colorblind") === "true";
store.savePreference = (_name, value) => localStorage.setItem("fuji-colorblind", String(value));
store.seat = 0;
let game: State;
const saved = localStorage.getItem("fuji-dev-v1");
try {
	game = saved ? JSON.parse(saved) : initGame(3, {}, "first-light");
	if (game.schemaVersion !== 1) throw Error("Old save");
} catch {
	game = initGame(3, {}, "first-light");
}
let teammateTimer: ReturnType<typeof setTimeout> | undefined;
store.autoTeammates = localStorage.getItem("fuji-auto-teammates") === "true";
function availableSeats() {
	return activePlayers(game).filter((i) => !["planning", "equipment"].includes(game.phase) || !game.players[i]!.ready);
}
function scheduleTeammate() {
	clearTimeout(teammateTimer);
	if (!store.autoTeammates || game.outcome || !availableSeats().some((i) => i !== store.seat)) return;
	teammateTimer = setTimeout(() => {
		if (store.animating) {
			scheduleTeammate();
			return;
		}
		const seat = availableSeats().find((i) => i !== store.seat);
		if (!store.autoTeammates || seat === undefined) return;
		try {
			game = moveAI(game, seat);
			publish();
		} catch (e) {
			store.setAutoTeammates(false);
			store.error = String(e);
		}
	}, 2200);
}
store.setAutoTeammates = (enabled) => {
	store.autoTeammates = enabled;
	localStorage.setItem("fuji-auto-teammates", String(enabled));
	scheduleTeammate();
};
if (import.meta.hot)
	import.meta.hot.dispose(() => {
		clearTimeout(teammateTimer);
		store.destroy();
	});
function publish() {
	localStorage.setItem("fuji-dev-v1", JSON.stringify(game));
	store.receive(stripSecret(game, store.seat));
	scheduleTeammate();
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
store.restart = (players, seed, difficulty, scenario = 1) => {
	game = initGame(players, { difficulty, scenario }, seed);
	store.seat = 0;
	publish();
};
store.exportDebug = () =>
	JSON.stringify(
		{
			format: "fuji-playtest-v1",
			engineVersion: enginePackage.version,
			exportedAt: new Date().toISOString(),
			seat: store.seat,
			autoTeammates: store.autoTeammates,
			playback: { round: store.scene?.round, phase: store.scene?.phase, logLength: store.journal.length },
			game,
		},
		null,
		2
	);
store.teammateStep = () => {
	if (store.animating) return;
	try {
		const available = availableSeats();
		const seat = available.find((i) => i !== store.seat) ?? available[0];
		if (seat === undefined) return;
		game = moveAI(game, seat);
		publish();
	} catch (e) {
		store.error = String(e);
	}
};
publish();
mount(App, { target: document.querySelector("#app")!, props: { store } });
