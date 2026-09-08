import { chromium } from "playwright";
import { initGame } from "../packages/engine/dist/index.js";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("work/browser", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
for (const difficulty of [1, 4])
	for (let scenario = 1; scenario <= 7; scenario++) {
		const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
		const state = initGame(4, { scenario, difficulty }, "scenario-preview");
		await page.addInitScript((s) => localStorage.setItem("fuji-dev-v1", JSON.stringify(s)), state);
		await page.goto("http://127.0.0.1:5187");
		await page.locator(".map").waitFor();
		assert((await page.locator(".map").getAttribute("aria-label")).includes("Scenario " + scenario));
		assert.equal(await page.locator(".location").count(), state.board.length);
		assert.equal((await page.locator(".legend-end").innerText()).trim(), "0/4");
		await page.screenshot({ path: `work/browser/scenario-${scenario}-level-${difficulty}.png`, fullPage: true });
		const guide = await page.locator(".map-guides").evaluate((el) => ({
			height: el.height.baseVal.value,
			actual: el.firstElementChild.getBoundingClientRect().height / el.getScreenCTM().a,
		}));
		assert(guide.actual <= guide.height + 1, JSON.stringify({ scenario, difficulty, guide }));
		await page.setViewportSize({ width: 390, height: 844 });
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
			false,
			`Mobile overflow: ${scenario}/${difficulty}`
		);
		await page.close();
	}
await browser.close();
console.log(
	"All seven layouts verified at difficulty 1 and 4, with village counters, unclipped guides and no mobile page overflow."
);
