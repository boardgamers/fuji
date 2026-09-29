import { serveAssets } from "./asset-server.mjs";
const assetBase = await serveAssets("packages/viewer/dist");
import { chromium } from "playwright";
import assert from "node:assert/strict";
const root = process.cwd() + "/";
const { initGame, applyMove, stripSecret, total, cell } = await import(root + "packages/engine/dist/index.js");
let state = initGame(3, { skillAssignment: "fixed" }, "mobile-readiness");
for (let i = 0; i < 3; i++)
	if (!state.players[i].setupDone)
		state = applyMove(
			state,
			{ action: "setup", keep: state.players[i].cards.slice(0, i === 2 ? 2 : 1).map((c) => c.id) },
			i
		);
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 740 }, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div>');
await page.addStyleTag({ url: assetBase + "/fuji-viewer.css" });
await page.addScriptTag({ url: assetBase + "/fuji-viewer.iife.js" });
await page.evaluate(
	(s) => {
		window.events = [];
		window.bridge = fuji.launch("#app");
		bridge.on("player:clicked", (p) => events.push(["player", p]));
		bridge.on("move", (p) => events.push(["move", p]));
		bridge.emit("player", { index: 0 });
		bridge.emit("state", s);
	},
	stripSecret(state, 0)
);
const previews = page.locator(".dice-preview");
await previews.first().waitFor({ state: "visible" });
for (const preview of await previews.all()) {
	const tileId = await preview.getAttribute("data-location");
	const value = Number(await preview.locator("text").textContent());
	assert.equal(value, total(state.players[0], cell(state, tileId).terrain) + state.players[0].bonus);
}

await page.evaluate(() => bridge.emit("chat:messages", []));
await page.getByRole("button", { name: "Journal", exact: true }).last().click();
assert.equal(await page.locator(".dock-chat").count(), 0, "no floating chat shortcut without unread messages");
await page.evaluate(() =>
	bridge.emit("chat:appended", [
		{ _id: "abcdef000000000000000001", author: "Teammate", playerIndex: 1, text: "Try the bridge", type: "text" },
	])
);
await page.waitForTimeout(100);
assert(
	await page
		.locator(".dock-chat")
		.textContent()
		.then((t) => t.includes("1"))
);
await page.locator(".dock-chat").click();
await page.waitForTimeout(700);
assert.equal(await page.locator(".dock-chat").count(), 0, "reading chat hides the shortcut again");

await page.setViewportSize({ width: 1440, height: 1000 });
assert(await page.locator(".dice-preview").first().isVisible());
assert(await page.locator(".desktop-journal").isVisible());
assert(!(await page.locator(".social-tabs").isVisible()));
assert.deepEqual(errors, []);
console.log("Fuji: mobile tabs, unread, desktop previews passed");
await browser.close();
