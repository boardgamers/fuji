// "Undo my move": BGS offers it to the only human of a game against bots (protocol 0.10.0).
import { serveAssets } from "./asset-server.mjs";
const assetBase = await serveAssets("packages/viewer/dist");
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { initGame, moveAI, activePlayers, stripSecret } from "../packages/engine/dist/index.js";
let game = initGame(3, { skillAssignment: "fixed" }, "undo-smoke");
while (game.phase !== "reroll")
	game = moveAI(
		game,
		activePlayers(game).find((i) => !(game.phase === "planning" && game.players[i].ready))
	);
// After a teammate's reroll, the local player's own choices are unchanged.
const earlier = stripSecret(game, 0);
const later = stripSecret(moveAI(game, 1), 0);
assert(later.revision > earlier.revision && later.log.length > earlier.log.length);
assert.deepEqual(later.players[0], earlier.players[0]);

const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	for (const width of [1400, 390]) {
		const page = await browser.newPage({ viewport: { width, height: 900 } });
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div>');
		await page.addStyleTag({ url: assetBase + "/fuji-viewer.css" });
		await page.addScriptTag({ url: assetBase + "/fuji-viewer.iife.js" });
		await page.evaluate((state) => {
			window.events = [];
			window.logs = [];
			window.bridge = fuji.launch("#app");
			for (const name of ["undo", "move"]) bridge.on(name, (payload) => events.push({ name, payload }));
			bridge.on("replaceLog", (lines) => logs.push(lines));
			bridge.emit("preferences", { sound: false });
			bridge.emit("player", { index: 0 });
			bridge.emit("state", state);
			bridge.emit("chat:state", { canSend: true });
		}, later);
		const undo = page
			.getByRole("navigation", { name: "Game options" })
			.getByRole("button", { name: "Undo my move", exact: true });
		const emit = (name, payload) => page.evaluate(([name, payload]) => bridge.emit(name, payload), [name, payload]);
		const gone = (selector, message) =>
			page
				.waitForFunction((selector) => !document.querySelector(selector), selector, { timeout: 5000 })
				.catch(() => assert.fail(message));
		const hidden = (message) => gone(".undo-move", message);
		await page.locator(".personal .die").first().waitFor();
		assert.equal(await undo.count(), 0, "hidden until BGS offers undo");

		await emit("undo:available", true);
		await undo.waitFor();
		assert.equal(await undo.getAttribute("title"), "Undo my move");
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			true,
			`header overflows at ${width}px`
		);
		const box = await undo.boundingBox();
		assert(box && box.x >= 0 && box.x + box.width <= width, "undo control must stay on screen");

		// A selection made on the later position must not survive the undo.
		await page.locator(".personal .die:not([disabled])").first().click();
		assert.equal(await page.locator(".personal .die.chosen").count(), 1);
		await undo.click();
		assert.deepEqual(await page.evaluate(() => events), [{ name: "undo", payload: undefined }]);
		await emit("state", earlier);
		await gone(".personal .die.chosen", "the earlier state must clear local selections");
		assert.equal((await page.evaluate(() => logs.at(-1))).length, earlier.log.length);
		assert.equal(await page.getByRole("button", { name: "Skip to latest" }).isVisible(), false);
		assert.equal(await page.locator(".teammate").nth(1).locator(".ready-label").textContent(), "Can act");
		await undo.waitFor();

		// Hidden while a move awaits the next state, for spectators and in analysis.
		await page.locator("button.finish-dice, .mobile-dock button").filter({ visible: true }).first().click();
		assert.equal((await page.evaluate(() => events)).at(-1).name, "move");
		await hidden("hidden while a move is pending");
		await emit("state", earlier);
		await undo.waitFor();
		await page.evaluate((state) => {
			bridge.emit("player", {});
			bridge.emit("state", state);
		}, stripSecret(game));
		await hidden("hidden for spectators");
		await page.evaluate((state) => {
			bridge.emit("player", { index: 0 });
			bridge.emit("state", state);
		}, earlier);
		await undo.waitFor();
		await emit("preferences", { sound: false, analysis: true });
		await hidden("hidden in analysis");
		await emit("preferences", { sound: false, locale: "fr" });
		await page.getByRole("button", { name: "Annuler mon coup", exact: true }).waitFor();

		await emit("undo:available", false);
		await hidden("hidden when BGS withdraws undo");
		assert.equal((await page.evaluate(() => events)).filter((e) => e.name === "undo").length, 1);
		assert.deepEqual(errors, []);
		await page.close();
	}
	console.log("Undo my move: offered only while available and interactive, requests undo, resets drafts on rewind.");
} finally {
	await browser.close();
}
