import { checkHostPresentation } from "./host-presentation-smoke.mjs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE });
const root = fileURLToPath(new URL("../", import.meta.url));
try {
	for (const game of ["fuji"]) {
		const engine = await import(
			game === "fuji" ? root + "/packages/engine/dist/wrapper.js" : root + "/engine/index.js"
		);
		const state = engine.stripSecret(await engine.init(3, [], {}, "analysis-chat-browser"), 0);
		for (const width of [390, 1400]) {
			const page = await browser.newPage({ viewport: { width, height: 950 } });
			const errors = [];
			page.on("pageerror", (e) => errors.push(e.message));
			await page.setContent(
				'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>'
			);
			const prefix = game === "fuji" ? root + "/packages/viewer/dist/fuji-viewer" : root + "/dist/viewer";
			await page.addStyleTag({ path: prefix + ".css" });
			await page.addScriptTag({ path: prefix + (game === "fuji" ? ".iife.js" : ".js") });
			await page.evaluate(
				({ state, game }) => {
					window.e = (game === "fuji" ? fuji : primordialSoup).launch("#app");
					window.requests = [];
					e.on("chat:translate", (request) => {
						requests.push(request);
						e.emit("chat:translation", { ...request, ok: true, text: "Bonjour <img src=x>", language: "en" });
					});
					e.emit("preferences", { sound: false });
					e.emit("player", { index: 0 });
					e.emit("state", state);
					e.emit("chat:state", { canSend: true, translationTarget: "fr" });
					e.emit("chat:messages", [
						{
							_id: "000000000000000000000070",
							type: "text",
							text: "Hello",
							language: "en",
							author: "Ada",
							playerIndex: 1,
						},
					]);
				},
				{ state, game }
			);
			await page.locator(".chat-translate").click();
			await page.getByRole("button", { name: "Translated · Show original", exact: true }).waitFor();
			assert.equal(await page.locator('[data-message-id="000000000000000000000070"] img').count(), 0);
			assert.match(
				await page.locator('[data-message-id="000000000000000000000070"]').textContent(),
				/Bonjour <img src=x>/
			);
			await page.locator(".chat-translate").click();
			assert.match(await page.locator('[data-message-id="000000000000000000000070"]').textContent(), /Hello/);
			assert.equal(await page.evaluate(() => requests.length), 1);
			await page.evaluate(() => e.emit("preferences", { sound: false, analysis: true }));
			await page.waitForFunction(() => !document.querySelector(".chat-translate")?.getBoundingClientRect().height);
			assert.equal(await page.getByRole("button", { name: /^Chat/ }).count(), 0);
			assert.equal(await page.getByRole("tab", { name: /^Chat/ }).count(), 0);
			await page.screenshot({ path: `/tmp/${game}-analysis-${width}.png`, fullPage: true });
			assert.deepEqual(errors, []);
			console.log(`${game} ${width}: translation/original/analysis passed`);
			await checkHostPresentation(page, "e", `/tmp/fuji-board-thumbnail-${width}.png`);
			assert.deepEqual(errors, []);
			await page.close();
		}
	}
} finally {
	await browser.close();
}
