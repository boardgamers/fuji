import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	for (const locale of ["fr", "de", "nl", "da", "it", "ro", "pt-BR", "pl", "ru", "el", "hi", "ko", "zh-TW", "vi"]) {
		const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.goto(`http://127.0.0.1:${server.address().port}`);
		await page.evaluate((locale) => fuji.launchTutorial("#app", { chapter: "first-steps", locale }), locale);
		await page.locator(".bgs-tutorial-heading strong").waitFor();
		await page.waitForTimeout(150);
		const content = await page.locator(".bgs-tutorial-guide").innerText();
		const catalog = JSON.parse(await readFile(`packages/viewer/src/localization/${locale}.json`, "utf8"));
		assert.equal(
			await page.locator(".bgs-tutorial-heading strong").textContent(),
			`1/8 · ${catalog["Escape together"]}`,
			locale
		);
		assert(
			!(await page
				.locator(".phase-track")
				.innerText()
				.then((text) => text.includes("Forest sanctuary"))),
			locale
		);
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
			false,
			locale + " overflow"
		);
		assert.deepEqual(errors, []);
		console.log(locale, content.slice(0, 70).replace(/\n/g, " "));
		await page.close();
	}
} finally {
	await browser.close();
	server.close();
}
