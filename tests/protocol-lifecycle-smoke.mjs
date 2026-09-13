import assert from "node:assert/strict";
import { chromium } from "playwright";
import { initGame, stripSecret } from "../packages/engine/dist/index.js";
const browser = await chromium.launch({ executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.setContent('<div id="app"></div>');
	await page.addStyleTag({ path: "packages/viewer/dist/fuji-viewer.css" });
	await page.addScriptTag({ path: "packages/viewer/dist/fuji-viewer.iife.js" });
	const state = stripSecret(initGame(3, {}, "protocol-lifecycle"), 0);
	await page.evaluate((state) => {
		window.old = fuji.launch("#app");
		old.emit("state", state);
		old.emit("chat:state", { canSend: true });
		window.events = [];
		window.current = fuji.launch("#app");
		for (const event of ["ready", "move", "chat:send"]) {
			current.on(event, (payload) => events.push({ event, payload }));
		}
		current.emit("player", { index: 0 });
		current.emit("state", state);
		old.emit("chat:messages", [{ type: "text", text: "Old game" }]);
		current.emit("chat:state", { canSend: true });
		current.emit("chat:messages", [{ _id: "000000000000000000000001", type: "text", text: "New game" }]);
	}, state);
	await page.waitForFunction(() => events.filter((e) => e.event === "ready").length === 1);
	assert.equal(await page.getByText("Old game", { exact: true }).count(), 0);
	assert.equal(await page.getByText("New game", { exact: true }).count(), 1);
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).count(), 1);
	assert.equal(await page.evaluate(() => fuji.diagnostics().compatible), true);
	assert.equal(await page.evaluate(() => old.emit("state:updated")), false);
	const input = page.getByRole("textbox", { name: "Chat message" });
	await input.fill("Original draft");
	await input.press("Enter");
	await input.fill("Edited while sending");
	await page.evaluate(() => {
		const request = events.find((e) => e.event === "chat:send").payload;
		current.emit("chat:result", { requestId: request.requestId, ok: true });
	});
	assert.equal(await input.inputValue(), "Edited while sending");
	await page.evaluate(() => fuji.destroy());
	assert.equal(await page.locator("#app").innerHTML(), "");
	assert.equal(await page.evaluate(() => current.emit("state:updated")), false);
	assert.deepEqual(errors, []);
	console.log("Fuji protocol: relaunch cleanup, readiness, diagnostics and pending draft preservation passed.");
} finally {
	await browser.close();
}
