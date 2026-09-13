import { chromium } from "playwright";
import { initGame, stripSecret } from "../packages/engine/dist/index.js";
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	const page = await browser.newPage();
	await page.goto("http://127.0.0.1:5187/");
	await page.locator(".map").waitFor();
	await page.locator(".equipment-chip").first().hover();
	await page.locator(".equipment-chip + .equipment-preview").first().waitFor({ state: "visible" });
	await page.screenshot({ path: "work/browser/fuji-equipment-preview.png", fullPage: true });
	const result = await page.evaluate(
		async (initial) => {
			const { Store } = await import("/src/lib/store.svelte.ts");
			const store = new Store();
			const assert = (condition, message) => {
				if (!condition) throw Error(message);
			};
			store.seat = 0;
			store.receive(initial);
			const next = structuredClone(initial);
			next.revision++;
			const start = initial.players[0].position;
			const target = initial.board.find((c) => !c.lava && c.id !== start).id;
			next.players[0].position = target;
			next.board.find((c) => c.id === start).lava = true;
			next.log.push({
				round: 1,
				type: "move",
				text: "Token moved",
				animation: { kind: "move", seat: 0, path: [start, target] },
			});
			next.log.push({
				round: 1,
				type: "eruption",
				text: "Lava followed",
				animation: { kind: "eruption", cells: [start] },
			});
			next.round = initial.round + 1;
			next.phase = "planning";
			next.players[0].dice[0].face = initial.players[0].dice[0].face === 6 ? 1 : 6;
			next.log.push({ round: next.round, type: "phase", text: "New round dice", sound: "dice" });
			store.receive(next);
			assert(
				store.scene.players[0].dice[0].face === initial.players[0].dice[0].face,
				"Next roll appeared before movement"
			);
			assert(
				store.state.revision === next.revision && store.state.board.find((c) => c.id === start).lava,
				"Authoritative state must update immediately"
			);
			assert(
				store.animating && store.journal.at(-1).text === "Token moved",
				"Movement must precede eruption in the journal"
			);
			assert(!store.scene.board.find((c) => c.id === start).lava, "Lava appeared before movement finished");
			store.receive(structuredClone(next));
			assert(
				store.animating && store.journal.at(-1).text === "Token moved",
				"Duplicate broadcasts interrupted playback"
			);
			await new Promise((resolve) => setTimeout(resolve, 760));
			assert(store.journal.at(-1).text === "Lava followed", "Eruption did not advance on its own");
			assert(store.scene.board.find((c) => c.id === start).lava, "Lava scene did not advance");
			assert(
				store.scene.players[0].dice[0].face === initial.players[0].dice[0].face,
				"Next roll appeared during eruption"
			);
			await new Promise((resolve) => setTimeout(resolve, 1150));
			assert(store.journal.at(-1).text === "New round dice", "Playback did not reach the roll");
			assert(
				store.scene.players[0].dice[0].face === next.players[0].dice[0].face,
				"Dice did not update at their roll cue"
			);
			const later = structuredClone(next);
			later.revision++;
			later.log.push({ round: 1, type: "equipment", text: "Later action" });
			store.receive(later);
			assert(store.journal.at(-1).text === "New round dice", "New updates jumped the queue");
			store.skipPresentation();
			assert(
				!store.animating && !store.waiting && store.journal.at(-1).text === "Later action",
				"Skip did not reach the latest state"
			);
			store.destroy();
			return "Ordered movement, eruption and journal; queued updates, duplicate broadcasts and skip passed";
		},
		stripSecret(initGame(3, {}, "presentation-test"), 0)
	);
	await page.evaluate(() => {
		window.soundStarts = 0;
		for (const type of [AudioBufferSourceNode, OscillatorNode]) {
			const original = type.prototype.start;
			type.prototype.start = function (...args) {
				window.soundStarts++;
				return original.apply(this, args);
			};
		}
	});
	await page.getByText("Playtest tools", { exact: true }).click();
	const soundToggle = page.getByRole("checkbox", { name: "Sound effects", exact: true });
	await soundToggle.uncheck();
	const previews = page.getByRole("group", { name: "Test sounds" });
	if (await previews.locator("button:not([disabled])").count()) throw Error("Muted sound previews must be disabled");
	await soundToggle.check();
	for (const name of ["Footstep", "Dice", "Lava", "Equipment"]) {
		const before = await page.evaluate(() => window.soundStarts);
		await previews.getByRole("button", { name, exact: true }).click();
		await page.waitForFunction((before) => window.soundStarts > before, before);
	}
	await soundToggle.uncheck();
	const initialSeed = await page.evaluate(() => JSON.parse(localStorage.getItem("fuji-dev-v1")).seed);
	await page.getByRole("button", { name: "New random game", exact: true }).click();
	if (initialSeed === (await page.evaluate(() => JSON.parse(localStorage.getItem("fuji-dev-v1")).seed)))
		throw Error("Random restart reused the seed");
	console.log(result + "; audio previews, mute and random restart passed");
} finally {
	await browser.close();
}
