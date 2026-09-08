import { chromium } from "playwright";
import path from "node:path";
(async () => {
	const root = process.cwd();
	const { initGame, applyMove, stripSecret, SKILLS, paths } = await import(root + "/packages/engine/dist/index.js");
	const game = initGame(3, {}, "bridge-test");
	const view = stripSecret(game, 2);
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
		window.bridge.emit("player", { index: 2 });
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
	for (let i = 0; i < 3; i++) {
		if (s.players[i].setupDone) continue;
		s = applyMove(
			s,
			{ action: "setup", keep: s.players[i].cards.slice(0, SKILLS[s.players[i].skill].keep).map((c) => c.id) },
			i
		);
	}
	await page.evaluate(() => window.bridge.emit("player", { index: 0 }));
	const teammatePath = Object.values(paths(s, 1)).find((route) => route.length > 1);
	s = applyMove(s, { action: "plan", path: teammatePath }, 1);
	s.players[1].radio = true;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.waitForSelector(".revealed-team");
	await page.waitForSelector('.teammate-route[data-player="1"] .shared-route-line', { state: "attached" });
	if (s.players[1].ready) throw Error("Shared route fixture must be unconfirmed");
	await page.screenshot({ path: "work/browser/fuji-shared-routes.png", fullPage: true });
	const overlap = structuredClone(s);
	overlap.players[0].path = [...teammatePath];
	overlap.players[0].ready = true;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(overlap, 1));
	await page.evaluate(() => window.bridge.emit("player", { index: 1 }));
	await page.waitForSelector('.teammate-route[data-player="0"] .shared-route-line', { state: "attached" });
	const routeStyles = await page.locator(".shared-route-line").evaluateAll((lines) =>
		lines.map((line) => ({
			points: line.getAttribute("points"),
			color: getComputedStyle(line).stroke,
			animation: getComputedStyle(line).animationName,
		}))
	);
	if (routeStyles.length !== 2 || routeStyles[0].points === routeStyles[1].points)
		throw Error("Overlapping routes must use distinct lanes");
	if (routeStyles[0].color === routeStyles[1].color) throw Error("Routes must retain player colors");
	if (routeStyles[0].animation !== "none" || !routeStyles[1].animation.includes("route-flow"))
		throw Error("Only provisional routes should animate");
	await page.waitForSelector(".location.reserved");
	if (await page.locator(".reserved-marker").count()) throw Error("Reservation must not add a redundant label");
	const movesBeforeReserved = await page.evaluate(() => window.captured.filter((e) => e.name === "move").length);
	await page.getByRole("button", { name: /reserved by .*choose another destination/ }).click();
	if ((await page.evaluate(() => window.captured.filter((e) => e.name === "move").length)) !== movesBeforeReserved)
		throw Error("Reserved destination must be inspected without submitting an invalid move");
	if (!(await page.getByText(/Choose another destination; you may still pass through/).isVisible()))
		throw Error("Reserved destination must explain the restriction");
	await page.screenshot({ path: "work/browser/fuji-overlapping-routes.png", fullPage: true });
	await page.evaluate(
		(v) => {
			window.bridge.emit("player", { index: 0 });
			window.bridge.emit("state", v);
		},
		stripSecret(s, 0)
	);
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
	await machete.click();
	const equipmentMove = await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload);
	s = applyMove(s, equipmentMove, 0);
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.getByText("Find equipment along the trail.", { exact: true }).waitFor();
	if (await page.locator(".tool-form").count()) throw Error("Discarded equipment left a stale action panel");
	if (await machete.count()) throw Error("Discarded machete remains usable");
	if (s.players[0].cards.some((c) => c.id === "machete")) throw Error("Machete was not consumed");
	s.phase = "movement";
	s.activeResolution = null;
	s.players[1].powerBars = 2;
	s = applyMove(s, { action: "beginMovement" }, 0);
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	await page.locator(".comparison").waitFor();
	if (await page.getByRole("button", { name: "Confirm result" }).count()) throw Error("Resolver should not confirm");
	if ((await page.locator(".teammate.can-act").count()) !== 1) throw Error("Only the Gatherer should be active");
	if (!(await page.locator(".public-bars").innerText()).includes("2 power bars"))
		throw Error("Public power bars missing");
	if (!(await page.getByText("Can help", { exact: true }).isVisible()))
		throw Error("Gatherer help availability missing");
	if ((await page.locator(".comparison-player").count()) !== 3) throw Error("Comparison must show every participant");
	if (await page.locator(".comparison-dice .die.aside").count()) throw Error("Set-aside dice must not count");
	const countedBeforeHover = await page.locator(".comparison").innerText();
	await page.locator(".location").last().hover();
	if ((await page.locator(".comparison").innerText()) !== countedBeforeHover)
		throw Error("Hover changed the resolution criterion");
	await page.screenshot({ path: "work/browser/fuji-comparison.png", fullPage: true });
	await page.evaluate(
		(v) => {
			window.bridge.emit("player", { index: 1 });
			window.bridge.emit("state", v);
		},
		stripSecret(s, 1)
	);
	await page.getByRole("button", { name: /Use 2 bars/ }).click();
	const helpMove = await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload);
	s = applyMove(s, helpMove, 1);
	if (!s.players[0].resolved || s.players[1].powerBars !== 0) throw Error("Help did not resolve movement");
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 1));
	await page.getByRole("button", { name: "Journal", exact: true }).click();
	await page.locator(".journal-dice .die").first().waitFor();
	await page.screenshot({ path: "work/browser/fuji-dice-journal.png", fullPage: true });
	await page.keyboard.press("Escape");
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
