import { mountLocalization, localizeTutorial } from "./localization";
import { installPlayerCards, createBoardThumbnail } from "./host-presentation";
import { mount, tick, unmount } from "svelte";
import { registerViewer } from "@boardgamers/protocol/viewer";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import type { View, Move } from "fuji-engine";
import "./lib/theme.css";
import { mountTutorial } from "./tutorial";

registerViewer<View, Move>(
	"fuji",
	({ target, move, openPlayer, hoverPlayer, leavePlayer, updatePreference, replaceLog }) => {
		const store = new Store();
		store.send = move;
		store.clickPlayer = openPlayer;
		store.savePreference = updatePreference;
		const app = mount(App, { target, props: { store } });
		const removeCards = installPlayerCards(target, { hoverPlayer, leavePlayer });
		const thumbnail = createBoardThumbnail(target);
		const localization = mountLocalization(target);
		return {
			chat: store.chat,
			async onThumbnail(size) {
				await tick();
				return thumbnail.render(target.querySelector("svg.map"), size, "#142f29");
			},
			async onState(state) {
				await localization.ready;
				localization.setState(state);
				store.receive(state);
				replaceLog(state.log.map((entry) => entry.text));
				await tick();
			},
			onPlayer({ index }) {
				store.seat = index;
			},
			async onPreferences(preferences) {
				if (!(await localization.setLocale(preferences.locale))) {
					return;
				}
				store.analysis = preferences.analysis === true;
				store.chatNotifications = preferences.chatNotifications !== false;
				store.colorblind = preferences.colorBlind === true;
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
				localization.destroy();
				removeCards();
				thumbnail.destroy();
				store.destroy();
				void unmount(app);
			},
		};
	},
	{ tutorial: localizeTutorial(mountTutorial) }
);
