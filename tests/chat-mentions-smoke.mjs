import { chromium } from "playwright";
import { initGame, stripSecret } from "../packages/engine/dist/index.js";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
for (const width of [390, 1400]) {
	const p = await browser.newPage({ viewport: { width, height: 950 } });
	const errors = [];
	p.on("pageerror", (e) => errors.push(e.message));
	await p.setContent('<div id="app"></div>');
	await p.addStyleTag({ path: root + "/packages/viewer/dist/fuji-viewer.css" });
	await p.addScriptTag({ path: root + "/packages/viewer/dist/fuji-viewer.iife.js" });
	const s = initGame(3, { skillAssignment: "fixed", scenario: 7, difficulty: 2 }, "mention-preview");
	s.phase = "movement";
	s.activeResolution = 1;
	s.players.forEach((x, i) => {
		x.skill = "buddy";
		x.setupDone = true;
		x.pendingInjuries = i === 1 ? 1 : 0;
		x.name = ["You", "Full Name", "Other"][i];
	});
	await p.evaluate(
		(s) => {
			window.e = fuji.launch("#app");
			window.sent = [];
			e.on("chat:send", (m) => sent.push(m));
			e.emit("player", { index: 0 });
			e.emit("state", s);
			e.emit("chat:state", {
				canSend: true,
				mentions: [
					{ id: "u0", name: "You", playerIndex: 0 },
					{ id: "u1", name: "Full Name", playerIndex: 1 },
				],
			});
			e.emit("chat:messages", [
				{
					_id: "000000000000000000000001",
					author: "Full Name",
					playerIndex: 1,
					type: "text",
					text: "Hi @You https://example.com",
					segments: [
						{ kind: "text", text: "Hi " },
						{ kind: "mention", id: "u1", name: "Full Name" },
						{ kind: "text", text: " — " },
						{ kind: "link", url: "https://example.com", text: "Rules" },
						{ kind: "text", text: " <script>alert(1)</script>" },
					],
				},
			]);
		},
		stripSecret(s, 0)
	);
	await p.getByRole("textbox", { name: "Chat message" }).fill("@");
	const suggestions = p.locator(".mention-choices");
	assert.equal(await suggestions.getByRole("button", { name: "@You", exact: true }).count(), 0);
	assert.equal(await suggestions.getByRole("button", { name: "@Full Name", exact: true }).isVisible(), true);
	await p.evaluate(() => e.emit("player", { index: 1 }));
	await suggestions.getByRole("button", { name: "@You", exact: true }).waitFor();
	assert.equal(await suggestions.getByRole("button", { name: "@Full Name", exact: true }).count(), 0);
	await p.evaluate(() => e.emit("player", { index: 0 }));
	await p.getByRole("textbox", { name: "Chat message" }).fill("@F");
	await p.getByRole("textbox", { name: "Chat message" }).press("Enter");
	assert.equal(await p.getByRole("textbox", { name: "Chat message" }).inputValue(), '@"Full Name" ');
	await p.getByRole("textbox", { name: "Chat message" }).press("End");
	await p.getByRole("textbox", { name: "Chat message" }).press("Enter");
	assert.equal(await p.evaluate(() => sent[0].text), '@"Full Name"');
	assert.equal(await p.getByRole("link", { name: "Rules", exact: true }).getAttribute("href"), "https://example.com");
	assert.equal(await p.locator("article script").count(), 0);
	assert.equal(await p.getByText(/Waiting for Full Name to choose an injury/).count(), 1);
	assert.equal(await p.getByText(/Gatherer.*decide/).count(), 0);
	assert.equal(await p.getByText("Scenario 7", { exact: true }).isVisible(), true);
	assert.equal(await p.getByRole("button", { name: "Difficulty level 2: stamina costs" }).isVisible(), true);
	assert.deepEqual(errors, []);
	await p.close();
}
await browser.close();
console.log(
	"Fuji desktop/mobile: mention autocomplete, plain send, rich safe rendering and injury waiting prompt passed."
);
