import { serveAssets } from "./asset-server.mjs";
const assetBase = await serveAssets("packages/viewer/dist");
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { initGame, stripSecret, applyMove } from "../packages/engine/dist/index.js";
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	const page = await browser.newPage();
	await page.setContent('<div id="app"></div>');
	await page.addStyleTag({ url: assetBase + "/fuji-viewer.css" });
	await page.addScriptTag({ url: assetBase + "/fuji-viewer.iife.js" });
	let state = initGame(3, { skillAssignment: "choose" }, "skill-ui");
	await page.evaluate(
		(view) => {
			window.bridge = window.fuji.launch("#app");
			window.moves = [];
			window.clicked = [];
			window.bridge.on("move", (m) => window.moves.push(m));
			window.bridge.on("player:clicked", (m) => window.clicked.push(m));
			window.bridge.emit("player", { index: 0 });
			window.bridge.emit("state", view);
		},
		stripSecret(state, 0)
	);
	await page.locator(".teammate-name").nth(1).click();
	assert.deepEqual(await page.evaluate(() => window.clicked), [{ index: 1 }]);
	assert.equal(await page.locator(".skill-choices button:enabled").count(), 6);
	await page.locator(".skill-choices button").filter({ hasText: "Equipment manager" }).click();
	const move = await page.evaluate(() => window.moves.at(-1));
	assert.deepEqual(move, { action: "chooseSkill", skill: "manager" });
	state = applyMove(state, move, 0);
	await page.evaluate(
		(view) => {
			window.bridge.emit("player", { index: 1 });
			window.bridge.emit("state", view);
		},
		stripSecret(state, 1)
	);
	assert(await page.locator(".skill-choices button").filter({ hasText: "Equipment manager" }).isDisabled());
	assert.equal(await page.locator(".skill-choices button:enabled").count(), 5);
	console.log("BGS player clicks and skill selection work; taken skills are disabled.");
} finally {
	await browser.close();
}
