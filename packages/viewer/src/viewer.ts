import { mount, tick } from "svelte";
import App from "./App.svelte";
import { Store } from "./lib/store.svelte";
import { Emitter } from "./lib/emitter";
import type { ChatMessage } from "./lib/chat.svelte";
import type { View } from "fuji-engine";
import "./lib/theme.css";
export function launch(selector: string) {
	const target = document.querySelector(selector);
	if (!target) throw Error("Viewer mount point not found.");
	const events = new Emitter();
	const store = new Store();
	let ready = false;
	const chat = store.chat;
	chat.send = (data) => events.emit("chat:send", data);
	chat.read = (messageId) => events.emit("chat:read", { messageId });
	events.on<ChatMessage[]>("chat:messages", (messages) => chat.replace(messages));
	events.on<ChatMessage[]>("chat:appended", (messages) => chat.append(messages));
	events.on<ChatMessage[]>("chat:updated", (messages) => {
		chat.messages = chat.messages.map((m) => messages.find((update) => update._id === m._id) ?? m);
	});
	events.on<string[]>("chat:deleted", (ids) => {
		chat.messages = chat.messages.filter((m) => !m._id || !ids.includes(m._id));
	});
	events.on<boolean>("chat:disabled", (disabled) => {
		chat.disabled = disabled;
	});
	events.on<{ canSend: boolean; reason?: string }>("chat:state", (state) => {
		chat.enabled = true;
		chat.canSend = state.canSend;
		chat.reason = state.reason ?? "";
	});
	events.on<{ requestId: string; ok: boolean; error?: string }>("chat:result", (result) => chat.result(result));

	store.savePreference = (name, value) => events.emit("update:preference", { name, value });
	events.on<Record<string, unknown>>("preferences", (preferences) => {
		store.colorblind = preferences?.colorblind === true;
		store.setSound(preferences?.sound !== false);
	});
	events.on<string[]>("avatars", (avatars) => {
		store.avatars = avatars;
	});
	store.clickPlayer = (index) => events.emit("player:clicked", { index });
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
