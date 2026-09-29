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
await page.locator(".teammate-status").first().click();
assert.deepEqual(await page.evaluate(() => events), []);
await page.locator(".teammate-name").first().click();
assert.equal((await page.evaluate(() => events))[0][0], "player");
await page.locator(".team-toggle").click();
for (const index of [0, 2]) {
	await page.locator(".teammate").nth(index).locator(".equipment-chip").first().click();
	await page.locator(".equipment-preview:popover-open").waitFor();
	const rect = await page.locator(".equipment-preview:popover-open").boundingBox();
	assert(rect && rect.x >= 0 && rect.x + rect.width <= 390 && rect.y >= 0 && rect.y + rect.height <= 740);

	await page.keyboard.press("Escape");
}
await page.evaluate(() => scrollTo(0, 600));
const rect = await page.locator(".mobile-dock").boundingBox();
assert(rect && rect.y > 600 && rect.y + rect.height <= 741);

await page.locator(".mobile-dock button").first().click();
assert.equal((await page.evaluate(() => events)).at(-1)[1].action, "ready");
assert.deepEqual(errors, []);
console.log(
	"Mobile ready button remains visible; only username emits player click; equipment previews fit first/last cards."
);
await browser.close();
