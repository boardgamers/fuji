import { chromium } from "playwright";
import path from "node:path";
(async () => {
	const root = process.cwd();
	const { initGame, applyMove, stripSecret, SKILLS } = await import(root + "/packages/engine/dist/index.js");
	const game = initGame(3, {}, "bridge-test");
	const view = stripSecret(game, 0);
	const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
	const page = await browser.newPage();
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.setContent('<html><head></head><body><div id="app"></div></body></html>');
	await page.addStyleTag({ path: root + "/packages/viewer/dist/fuji-viewer.css" });
	await page.addScriptTag({ path: root + "/packages/viewer/dist/fuji-viewer.iife.js" });
	await page.evaluate((view) => {
		window.captured = [];
		window.bridge = window.fuji.launch("#app");
		for (const name of ["ready", "move", "fetchState", "replaceLog"])
			window.bridge.on(name, (payload) => window.captured.push({ name, payload }));
		window.bridge.emit("player", { index: 0 });
		window.bridge.emit("state", view);
	}, view);
	await page.getByRole("button", { name: "Ready for the journey" }).click();
	await page.evaluate(() => {
		window.bridge.emit("state:updated");
		window.bridge.emit("gamelog", { start: 0, data: { log: [] } });
	});
	let captured = await page.evaluate(() => window.captured);
	const move = captured.find((e) => e.name === "move")?.payload;
	if (move?.action !== "setup" || "move" in move) throw Error("Wrong move contract");
	if (captured.filter((e) => e.name === "ready").length !== 1) throw Error("Wrong readiness handshake");
	if (captured.filter((e) => e.name === "fetchState").length !== 2) throw Error("Updates must request state");
	if (await page.locator(".dev-toolbar").count()) throw Error("Local harness leaked into bundle");
	let s = game;
	for (let i = 0; i < 3; i++)
		s = applyMove(
			s,
			{ action: "setup", keep: s.players[i].cards.slice(0, SKILLS[s.players[i].skill].keep).map((c) => c.id) },
			i
		);
	s.players[1].radio = true;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.waitForSelector(".revealed-team");
	if ((await page.locator(".revealed-team .die:not(.hidden)").count()) !== 6) throw Error("Radio not rendered");
	await page.evaluate((v) => {
		window.bridge.emit("player", {});
		window.bridge.emit("state", v);
	}, stripSecret(s));
	if (await page.locator(".personal .die").count()) throw Error("Spectator has personal dice");
	console.log(
		JSON.stringify({
			errors,
			ready: captured.filter((e) => e.name === "ready").length,
			fetchState: captured.filter((e) => e.name === "fetchState").length,
			move,
			radioVisible: true,
			localHarnessAbsent: true,
		})
	);
	if (errors.length) throw Error("Runtime errors");
	await browser.close();
})();
