import { mount, tick, unmount } from "svelte";
import { createTutorial, type TutorialMount } from "@boardgamers/protocol/tutorial";
import { mountTutorialGuide } from "@boardgamers/protocol/tutorial/dom";
import { stripSecret } from "fuji-engine";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import { lessons } from "./tutorial/lessons";
import "./lib/theme.css";
import "./tutorial/tutorial.css";

export const mountTutorial: TutorialMount = async (target, { chapter, onProgress }) => {
	const lesson = lessons.find((entry) => entry.id === chapter);
	if (!lesson) throw Error("Unknown chapter");
	target.className = "tutorial-session";
	const guide = document.createElement("div");
	guide.className = "tutorial-guide-host";
	const game = document.createElement("div");
	target.append(guide, game);
	let storage: Storage | undefined;
	try {
		storage = localStorage;
	} catch {
		/* Private browsing may block persistence. */
	}
	const store = new Store();
	store.seat = 0;
	store.chat.setDisabled(true);
	let animateNextMove = false;
	const controller = await createTutorial({
		...lesson,
		storage,
		onProgress,
		move: async (state, move) => {
			const animate = animateNextMove;
			animateNextMove = false;
			const next = await lesson.move(state, move);
			if (animate) await store.present(stripSecret(next, 0));
			return next;
		},
	});
	store.send = (move) => {
		animateNextMove = true;
		void controller.play(move).finally(() => {
			animateNextMove = false;
		});
	};
	const unsubscribe = controller.subscribe(({ state, error, busy, canContinue, completed }) => {
		store.receive(stripSecret(state, 0));
		store.error = error;
		store.waiting = busy || canContinue || completed;
	});
	const app = mount(App, { target: game, props: { store } });
	await tick();
	const cleanupGuide = mountTutorialGuide(guide, controller);
	const resize = new ResizeObserver(() => {
		target.style.setProperty("--tutorial-height", `${guide.getBoundingClientRect().height}px`);
	});
	resize.observe(guide);
	return () => {
		resize.disconnect();
		cleanupGuide();
		unsubscribe();
		controller.destroy();
		store.destroy();
		void unmount(app);
	};
};
