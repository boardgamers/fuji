import { mount, tick } from "svelte";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import { Emitter } from "./lib/emitter";
import type { View } from "fuji-engine";
import "./lib/theme.css";
export function launch(selector: string) {
	const target = document.querySelector(selector);
	if (!target) throw Error("Viewer mount point not found.");
	const events = new Emitter();
	const store = new Store();
	let ready = false;
	store.savePreference = (name, value) => events.emit("update:preference", { name, value });
	events.on<Record<string, unknown>>("preferences", (preferences) => {
		store.colorblind = preferences?.colorblind === true;
	});
	store.send = (move) => events.emit("move", move);
	events.on<View>("state", async (state) => {
		store.receive(state);
		events.emit(
			"replaceLog",
			state.log.map((e) => e.text)
		);
		await tick();
		if (!ready) {
			ready = true;
			setTimeout(() => events.emit("ready"), 0);
		}
	});
	events.on<{ index?: number }>("player", (p) => {
		store.seat = p?.index;
	});
	events.on("state:updated", () => events.emit("fetchState"));
	events.on("gamelog", () => events.emit("fetchState"));
	mount(App, { target, props: { store } });
	return events;
}
if (typeof window !== "undefined") (window as unknown as { fuji: unknown }).fuji = { launch };
