import { chromium } from "playwright";
import { initGame, stripSecret, total, paths, terrain } from "../packages/engine/dist/index.js";
import assert from "node:assert/strict";
const root = process.cwd();
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
for (const ready of [false, true]) {
	const s = initGame(4, { skillAssignment: "fixed" }, "impacts");
	s.phase = "planning";
	s.players.forEach((p) => {
		p.setupDone = true;
		p.ready = false;
		p.dice.forEach((d) => (d.face = 3));
	});
	s.players[0].bonus = 3;
	const reach = paths(s, 0);
	const far = s.board.find((c) => !c.lava && terrain(c.terrain).kind === "land" && !reach[c.id]);
	const near = s.board.find((c) => c.id !== s.players[0].position && reach[c.id]);
	for (const [i, c] of [
		[1, far],
		[2, near],
		[3, near],
	]) {
		s.players[i].path = [s.players[i].position, c.id];
		s.players[i].ready = ready;
	}
	const p = await browser.newPage({ viewport: { width: 390, height: 840 } });
	const errors = [];
	p.on("pageerror", (e) => errors.push(e.message));
	await p.setContent('<div id="app"></div>');
	await p.addStyleTag({ path: root + "/packages/viewer/dist/fuji-viewer.css" });
	await p.addScriptTag({ path: root + "/packages/viewer/dist/fuji-viewer.iife.js" });
	await p.evaluate(
		(s) => {
			window.e = fuji.launch("#app");
			e.emit("player", { index: 0 });
			e.emit("state", s);
		},
		stripSecret(s, 0)
	);
	await p.locator(".impact-preview").first().waitFor();
	assert.equal(await p.locator(".impact-preview").count(), 2);
	assert.equal(await p.locator('.impact-preview[data-player="2"]').count(), 0);
	assert.equal(
		await p.locator('.impact-preview[data-player="1"] text').textContent(),
		String(total(s.players[0], far.terrain))
	);
	assert.equal(await p.locator(".impact-preview.provisional").count(), ready ? 0 : 2);
	assert.equal(await p.locator('.impact-preview[data-player="3"]').count(), 1);
	assert.equal(await p.locator(`.dice-preview:not(.impact-preview)[data-location="${near.id}"]`).count(), 0);
	const markers = await p.locator(".conflict-badges > span").count();
	assert(markers > 0);
	assert.equal(await p.locator(".conflict-badges > span.provisional").count(), ready ? 0 : markers);
	assert.deepEqual(errors, []);
	await p.close();
}
await browser.close();
console.log(
	"Planning previews: unreachable/reachable destinations, neighbour filtering, own dice totals, provisional/confirmed borders passed."
);
