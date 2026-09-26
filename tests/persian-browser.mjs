import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { initGame, stripSecret } from "../packages/engine/dist/index.js";

const server = createServer(async (req, res) => {
	if (req.url.startsWith("/dist/")) {
		res.setHeader("content-type", req.url.endsWith("css") ? "text/css" : "text/javascript; charset=utf-8");
		res.end(await readFile(`packages/viewer${req.url}`));
	} else {
		res.setHeader("content-type", "text/html; charset=utf-8");
		res.end(
			'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/dist/fuji-viewer.css"><div id="app"></div><script src="/dist/fuji-viewer.iife.js"></script>'
		);
	}
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
const errors = [];
try {
	for (const width of [390, 1440]) {
		const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
		page.on("pageerror", (error) => errors.push(error.message));
		await page.goto(`http://127.0.0.1:${server.address().port}`);
		for (const chapter of ["first-steps", "equipment", "terrain-bonuses", "lava", "village"]) {
			await page.evaluate(async (chapter) => {
				await fuji.launchTutorial("#app", { chapter, locale: "fa-IR" });
			}, chapter);
			await page.getByRole("button", { name: "بازگشت به آغاز", exact: true }).waitFor();
			assert.match(await page.locator(".bgs-tutorial-body").innerText(), /[\u0600-\u06ff]/u);
			assert.doesNotMatch(await page.locator(".bgs-tutorial-body").innerText(), /Choose |Your |You |Help |Routes /);
			assert.equal(await page.locator(".bgs-tutorial-guide").evaluate((el) => getComputedStyle(el).direction), "rtl");
			assert.equal(await page.locator("svg.map").evaluate((el) => getComputedStyle(el).direction), "ltr");
			assert.ok(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
				`${chapter}: no overflow at ${width}px`
			);
		}
		await page.evaluate(async () => {
			localStorage.clear();
			await fuji.launchTutorial("#app", { chapter: "first-steps", locale: "fa-IR" });
		});
		const guide = page.locator(".bgs-tutorial-guide");
		const step = (n) =>
			page.waitForFunction(
				(n) => document.querySelector(".bgs-tutorial-heading strong")?.textContent.startsWith(`${n}/8`),
				n
			);
		await step(1);
		await guide.getByRole("button", { name: "ادامه", exact: true }).click();
		await step(2);
		await page.locator('[data-tutorial="tile:1,3"]').click();
		await step(3);
		await guide.getByRole("button", { name: "ادامه", exact: true }).click();
		await step(4);
		await page.locator('[data-tutorial="confirm"]:visible').first().click();
		await step(5);
		const dice = page.locator(".personal .dice-row .die");
		const xs = await dice.evaluateAll((nodes) => nodes.map((el) => el.getBoundingClientRect().x));
		assert.ok(
			xs.every((x, i) => !i || x > xs[i - 1]),
			"Persian keeps dice in original left-to-right order"
		);
		for (const index of [3, 4, 5]) await dice.nth(index).click();
		await page.getByRole("button", { name: /تکرار.*3.*↻/ }).click();
		await step(6);
		await page.locator(".personal .die.bgs-tutorial-highlight").click();
		await page.getByRole("button", { name: "کنار گذاشتن تاس انتخاب‌شده", exact: true }).click();
		await step(7);
		await page.locator('[data-tutorial="confirm"]:visible').first().click();
		await step(8);
		await page.locator('[data-tutorial="resolve"]:visible').first().click();
		await page.waitForFunction(
			() => document.querySelector(".bgs-tutorial-heading strong")?.textContent === "فصل تمام شد"
		);
		assert.match(await guide.innerText(), /به دیده‌بانی تپه رسیدید/);

		const state = initGame(3, { autoMovement: false, autoProgress: false, skillAssignment: "fixed" }, "persian");
		state.players[2].name = "Map";
		await page.evaluate(
			(state) => {
				window.bridge = fuji.launch("#app");
				bridge.emit("player", { index: 2 });
				bridge.emit("state", state);
				bridge.emit("preferences", { locale: "en" });
			},
			stripSecret(state, 2)
		);
		await page.waitForFunction(() =>
			document.querySelector(".expedition")?.textContent.includes("Prepare your expedition")
		);
		const geometry = () =>
			page
				.locator("svg.map")
				.evaluate((el) =>
					[...el.querySelectorAll("path,circle,rect,g")].map((node) =>
						["d", "x", "y", "cx", "cy", "transform"].map((a) => node.getAttribute(a))
					)
				);
		const before = await geometry();
		await page.evaluate(() => bridge.emit("preferences", { locale: "fa-IR" }));
		await page.waitForFunction(() =>
			document.querySelector(".expedition")?.textContent.includes("ماجراجویی خود را آماده کنید")
		);
		assert.deepEqual(await geometry(), before, "Persian leaves map geometry unchanged");
		assert.ok(await page.getByText("Map", { exact: true }).count(), "player name remains unchanged");
		await page.evaluate(() => bridge.emit("preferences", { locale: "en" }));
		await page.waitForFunction(() =>
			document.querySelector(".expedition")?.textContent.includes("Prepare your expedition")
		);
		assert.deepEqual(await geometry(), before);
		await page.close();
		console.log(`Persian chapters, complete interactive lesson, dice order and locale switching: ${width}px passed`);
	}
	assert.deepEqual(errors, []);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
