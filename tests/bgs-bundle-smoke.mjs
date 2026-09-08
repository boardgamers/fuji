import { chromium } from "playwright";
import path from "node:path";
(async () => {
	const root = process.cwd();
	const { initGame, applyMove, stripSecret, SKILLS, paths } = await import(root + "/packages/engine/dist/index.js");
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
		for (const name of ["ready", "move", "fetchState", "replaceLog", "update:preference"])
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
	if (await page.locator(".dev-toolbar, .playtest-menu").count()) throw Error("Local harness leaked into bundle");
	if (await page.locator(".masthead, footer, .credits").count())
		throw Error("Page framing leaked into embedded viewer");
	let s = game;
	for (let i = 0; i < 3; i++)
		s = applyMove(
			s,
			{ action: "setup", keep: s.players[i].cards.slice(0, SKILLS[s.players[i].skill].keep).map((c) => c.id) },
			i
		);
	const teammatePath = Object.values(paths(s, 1)).find((route) => route.length > 1);
	s = applyMove(s, { action: "plan", path: teammatePath }, 1);
	s.players[1].radio = true;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.waitForSelector(".revealed-team");
	await page.waitForSelector('.teammate-route[data-player="1"] .shared-route-line', { state: "attached" });
	if (s.players[1].ready) throw Error("Shared route fixture must be unconfirmed");
	await page.screenshot({ path: "work/browser/fuji-shared-routes.png", fullPage: true });
	if ((await page.locator(".revealed-team .die:not(.hidden)").count()) !== 6) throw Error("Radio not rendered");
	if (await page.locator(".die-caption").count()) throw Error("Color labels should be off by default");
	await page.evaluate(() => window.bridge.emit("preferences", { colorblind: true }));
	await page.waitForSelector(".die-caption");
	await page.getByRole("button", { name: "Open playing guide" }).click();
	await page.getByRole("checkbox", { name: "Show color labels (colorblind support)" }).uncheck();
	const preference = await page.evaluate(
		() => window.captured.findLast((e) => e.name === "update:preference")?.payload
	);
	if (preference?.name !== "colorblind" || preference.value !== false) throw Error("Wrong preference uplink");
	if (await page.locator(".die-caption").count()) throw Error("Color labels did not turn off");
	await page.keyboard.press("Escape");
	if ((await page.locator(".village-marker").count()) !== 5) throw Error("Every village location needs a marker");
	s.phase = "reroll";
	s.players[0].rerolls = 0;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.locator(".personal .die").first().click();
	const aside = page.getByRole("button", { name: "Set selected die aside" });
	if (!(await aside.isEnabled())) throw Error("Buddy must be usable with zero rerolls");
	await aside.click();
	if ((await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload.action)) !== "buddy")
		throw Error("Buddy action missing");
	s.phase = "equipment";
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.locator(".equipment-list button").filter({ hasText: "Machete" }).click();
	const machete = page.getByRole("button", { name: "Use Machete", exact: true });
	if (!(await machete.isDisabled())) throw Error("Machete needs selected dice");
	await page.locator(".personal .die").first().click();
	if (!(await machete.isEnabled())) throw Error("Machete should accept one selected die");
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
