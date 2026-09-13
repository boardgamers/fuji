import { mount, tick, unmount } from "svelte";
import { registerViewer } from "@boardgamers/protocol/viewer";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import type { View, Move } from "fuji-engine";
import "./lib/theme.css";

registerViewer<View, Move>("fuji", ({ target, move, openPlayer, updatePreference, replaceLog }) => {
	const store = new Store();
	store.send = move;
	store.clickPlayer = openPlayer;
	store.savePreference = updatePreference;
	const app = mount(App, { target, props: { store } });
	return {
		chat: store.chat,
		async onState(state) {
			store.receive(state);
			replaceLog(state.log.map((entry) => entry.text));
			await tick();
		},
		onPlayer({ index }) {
			store.seat = index;
		},
		onPreferences(preferences) {
			store.colorblind = preferences.colorblind === true;
			store.setSound(preferences.sound !== false);
		},
		onAvatars(avatars) {
			store.avatars = avatars;
		},
		onError(error) {
			store.error = error instanceof Error ? error.message : String(error);
			store.waiting = false;
		},
		destroy() {
			store.destroy();
			void unmount(app);
		},
	};
});
