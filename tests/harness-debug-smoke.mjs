import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { replay } from "../packages/engine/dist/index.js";
mkdirSync("work/browser", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	const page = await browser.newPage();
	await page.goto("http://127.0.0.1:5187");
	await page.locator(".map").waitFor();
	await page.getByText("Playtest tools", { exact: true }).click();
	const expected = JSON.parse(await page.evaluate(() => localStorage.getItem("fuji-dev-v1")));
	const downloading = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download debug file", exact: true }).click();
	const download = await downloading;
	await download.saveAs("work/browser/debug-test.json");
	const snapshot = JSON.parse(readFileSync("work/browser/debug-test.json", "utf8"));
	assert.equal(snapshot.format, "fuji-playtest-v1");
	assert.deepEqual(snapshot.game, expected);
	assert.deepEqual(replay(snapshot.game), snapshot.game);
	assert.equal(snapshot.seat, 0);
	console.log("Debug export preserves exact state, selected seat and deterministic replay.");
} finally {
	await browser.close();
}
