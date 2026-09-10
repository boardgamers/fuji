import { chromium } from "playwright";
import assert from "node:assert/strict";
import { initGame, stripSecret } from "../packages/engine/dist/index.js";
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
try {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.setContent('<div id="app"></div>');
	await page.addStyleTag({ path: "packages/viewer/dist/fuji-viewer.css" });
	await page.addScriptTag({ path: "packages/viewer/dist/fuji-viewer.iife.js" });
	await page.evaluate(
		(view) => {
			window.events = [];
			window.bridge = window.fuji.launch("#app");
			for (const name of ["chat:send", "chat:read"])
				window.bridge.on(name, (data) => window.events.push({ name, data }));
			window.bridge.emit("state", view);
			window.bridge.emit("player", { index: 0 });
			window.bridge.emit("chat:messages", [
				{ _id: "000000010000000000000001", author: "Alice", playerIndex: 0, type: "text", text: "From the lobby" },
			]);
			window.bridge.emit("chat:state", { canSend: true });
		},
		stripSecret(initGame(3, {}, "chat-test"), 0)
	);
	const panel = page.getByRole("region", { name: "Expedition chat", exact: true });
	await panel.scrollIntoViewIfNeeded();
	await page.waitForFunction(() => window.events.some((e) => e.name === "chat:read"));
	await page.getByRole("textbox", { name: "Chat message" }).fill("Let's go");
	await page.getByRole("button", { name: "Send", exact: true }).click();
	let request = await page.evaluate(() => window.events.find((e) => e.name === "chat:send").data);
	assert.equal(request.text, "Let's go");
	await page.evaluate(
		(request) => window.bridge.emit("chat:result", { requestId: request.requestId, ok: false, error: "Rate limited" }),
		request
	);
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).inputValue(), "Let's go");
	assert.equal(await page.getByRole("alert").innerText(), "Rate limited");
	await page.getByRole("button", { name: "Send", exact: true }).click();
	request = await page.evaluate(() => window.events.filter((e) => e.name === "chat:send").at(-1).data);
	await page.evaluate((request) => {
		window.bridge.emit("chat:result", { requestId: request.requestId, ok: true });
		window.bridge.emit("chat:appended", [
			{ _id: "000000020000000000000002", author: "Me", text: request.text, type: "text" },
		]);
	}, request);
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).inputValue(), "");
	await page.getByRole("textbox", { name: "Chat message" }).fill("Still drafting");
	await page.evaluate(() => {
		window.bridge.emit("chat:updated", [
			{ _id: "000000010000000000000001", author: "Alice", text: "Edited lobby message", type: "text" },
		]);
		window.bridge.emit("chat:deleted", ["000000020000000000000002"]);
	});
	assert.equal(await panel.getByText("Edited lobby message").count(), 1);
	assert.equal(await panel.getByText("Let's go", { exact: true }).count(), 0);
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).inputValue(), "Still drafting");
	await page.evaluate(() => {
		window.bridge.emit("chat:messages", [{ _id: "000000030000000000000003", text: "Reconnected", type: "system" }]);
	});
	assert.equal(await panel.getByText("Edited lobby message").count(), 0);
	assert.equal(await panel.getByText("Reconnected").count(), 1);
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).inputValue(), "Still drafting");
	// Once the newest message was read, scrolling through older history must be silent.
	await page.evaluate(() =>
		window.bridge.emit(
			"chat:messages",
			Array.from({ length: 40 }, (_, i) => ({
				_id: (100 + i).toString(16).padStart(8, "0") + "0000000000000000",
				text: `Message ${i}`,
				type: "text",
			}))
		)
	);
	await page.locator(".chat-messages").evaluate((el) => {
		el.scrollTop = el.scrollHeight;
		el.dispatchEvent(new Event("scroll"));
	});
	await page.waitForTimeout(650);
	const receipts = await page.evaluate(() => window.events.filter((e) => e.name === "chat:read").length);
	for (const top of [0, 200, 500, 100, 99999, 0, 99999]) {
		await page.locator(".chat-messages").evaluate((el, top) => {
			el.scrollTop = top;
			el.dispatchEvent(new Event("scroll"));
		}, top);
	}
	await page.getByRole("button", { name: "Collapse chat" }).click();
	await page.getByRole("button", { name: "Expand chat" }).click();
	await page.waitForTimeout(650);
	assert.equal(await page.evaluate(() => window.events.filter((e) => e.name === "chat:read").length), receipts);
	await page.evaluate(() =>
		window.bridge.emit("chat:appended", [{ _id: "0000008c0000000000000000", text: "New arrival", type: "text" }])
	);
	await page.waitForTimeout(650);
	assert.equal(await page.evaluate(() => window.events.filter((e) => e.name === "chat:read").length), receipts + 1);
	await page.screenshot({ path: "work/chat-desktop.png" });
	await page.evaluate(() => window.bridge.emit("chat:disabled", true));
	assert.equal(await page.getByRole("textbox", { name: "Chat message" }).count(), 0);
	assert.equal(await panel.getByText("Chat is disabled.").count(), 1);
	await page.setViewportSize({ width: 390, height: 844 });
	await panel.scrollIntoViewIfNeeded();
	await page.screenshot({ path: "work/chat-mobile.png" });
	assert.deepEqual(errors, []);
	console.log(
		"Chat bridge: history, send success/failure, draft preservation, edits, deletes and disabled state passed."
	);
} finally {
	await browser.close();
}
