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
await page.addStyleTag({ path: root + "packages/viewer/dist/fuji-viewer.css" });
await page.addScriptTag({ path: root + "packages/viewer/dist/fuji-viewer.iife.js" });
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
for (const width of [320, 390, 430, 768]) {
	await page.setViewportSize({ width, height: 740 });
	await page.evaluate(() => scrollTo(0, 0));
	assert.ok(
		await page.locator(".landscape").evaluate((el) => el.getBoundingClientRect().top < 170),
		"The map is visible immediately on mobile"
	);
	assert.ok(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
		"No horizontal page overflow"
	);
	const team = page.locator(".team");
	assert.equal(
		await team.evaluate((el) => getComputedStyle(el).flexWrap),
		"nowrap",
		"Teammates form a horizontal rail"
	);
	assert.equal(await page.locator(".mobile-sections").count(), 0, "No redundant shortcut bar");
	await page.locator(".team-toggle").click();
	assert.ok(await page.locator(".team.expanded .role-details").first().isVisible());
	await page.locator(".team-toggle").click();
	const dock = await page.locator(".mobile-dock").boundingBox();
	assert.ok(dock.y + dock.height >= 739, "Confirmation stays at the bottom");
}
assert.deepEqual(errors, []);
console.log("Fuji mobile: central map, expandable teammate rail, bottom confirmation and no horizontal page overflow.");
await browser.close();
