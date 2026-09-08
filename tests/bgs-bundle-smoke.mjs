import { chromium } from "playwright";
import path from "node:path";
(async () => {
	const root = process.cwd();
	const { initGame, applyMove, stripSecret, SKILLS, paths, comparison } = await import(
		root + "/packages/engine/dist/index.js"
	);
	const game = initGame(3, { autoMovement: false, autoProgress: false }, "bridge-test");
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
	if ((await page.locator(".phase-track svg").count()) !== 5) throw Error("Phase strip must show five icons");
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
	const conflictState = initGame(4, {}, "dice-conflicts");
	conflictState.phase = "reroll";
	conflictState.board.forEach((c) => {
		if (!c.lava) c.terrain = 16;
	});
	conflictState.players.forEach((p) => {
		p.path = [p.position];
		p.ready = false;
		p.rerolls = 1;
	});
	conflictState.players[0].dice.forEach((d) => (d.face = 1));
	conflictState.players[0].dice[0].aside = true;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(conflictState, 0));
	const conflictMarkers = page.locator(".personal .conflict-badges > span");
	const markers = await conflictMarkers.allTextContents();
	if (markers.length !== 10 || markers.some((m) => !["2", "4"].includes(m)))
		throw Error("Only comparison neighbors should be marked; set-aside dice must be excluded");
	conflictState.players[1].dice.forEach((d) => (d.face = 6));
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(conflictState, 0));
	if (JSON.stringify(await conflictMarkers.allTextContents()) !== JSON.stringify(markers))
		throw Error("Conflict markers used hidden teammate rolls");
	await page.screenshot({ path: "work/browser/fuji-dice-conflicts.png", fullPage: true });
	conflictState.phase = "equipment";
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(conflictState, 0));
	if (await conflictMarkers.count()) throw Error("Reroll conflict markers leaked into another phase");
	s.phase = "reroll";
	s.players[0].rerolls = 0;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 0));
	const matchingBeforeHover = await page.locator(".personal .matching-badge").allTextContents();
	await page.locator(".location").last().hover();
	if (
		JSON.stringify(await page.locator(".personal .matching-badge").allTextContents()) !==
		JSON.stringify(matchingBeforeHover)
	)
		throw Error("Reroll matching badges must stay tied to the chosen destination");
	await page.screenshot({ path: "work/browser/fuji-matching-dice.png", fullPage: true });
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
	const torchState = structuredClone(s);
	torchState.phase = "planning";
	torchState.players[0].cards = [{ id: "torch", used: 0, availableRound: 0 }];
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(torchState, 0));
	await page.locator(".equipment-list button").filter({ hasText: "Torch" }).click();
	const torch = page.getByRole("button", { name: "Use Torch", exact: true });
	if (!(await torch.isDisabled())) throw Error("Torch needs at least one selected die");
	await page.getByText(/Select one or more dice to reroll below the map/).waitFor();
	const selectableDie = page.locator(".personal .die:not([disabled])").first();
	await selectableDie.click();
	if (!(await torch.isEnabled())) throw Error("Torch should accept one selected die");
	await selectableDie.click();
	if (!(await torch.isDisabled())) throw Error("Deselecting all dice must disable Torch again");
	await selectableDie.click();
	await torch.click();
	const torchMove = await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload);
	const torchResult = applyMove(torchState, torchMove, 0);
	if (torchResult.players[0].cards.length) throw Error("Torch should be consumed after a valid reroll");

	const managerState = structuredClone(s);
	managerState.players[0].skill = "manager";
	managerState.players[0].cards = [{ id: "map", used: 0, availableRound: 0 }];
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(managerState, 0));
	await page.locator(".equipment-list button").filter({ hasText: "Map" }).click();
	await page.getByRole("group", { name: "Lend a die to" }).getByRole("button", { name: "Lady Livingstone" }).click();
	if (await page.getByRole("group", { name: "Give card to" }).isVisible())
		throw Error("Card transfer should start collapsed");
	await page.getByText("Give this card…", { exact: true }).click();
	await page.getByRole("group", { name: "Give card to" }).getByRole("button", { name: "Hiromi" }).click();
	if (
		(await page
			.getByRole("group", { name: "Lend a die to" })
			.getByRole("button", { name: "Lady Livingstone" })
			.getAttribute("aria-pressed")) !== "true"
	)
		throw Error("Card transfer must not change the die recipient");
	await page.screenshot({ path: "work/browser/fuji-equipment-transfer.png", fullPage: true });
	await page.getByRole("button", { name: "Give Map card", exact: true }).click();
	const giveMove = await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload);
	if (giveMove.action !== "give" || giveMove.target !== 2) throw Error("Wrong card transfer recipient");
	const given = applyMove(managerState, giveMove, 0);
	if (!given.players[2].cards.some((c) => c.id === "map")) throw Error("Map card was not transferred");

	const knifeState = structuredClone(s);
	knifeState.players[0].cards = [{ id: "knife", used: 0, availableRound: 0 }];
	knifeState.players[1].cards = [
		{ id: "map", used: 0, availableRound: 0 },
		{ id: "shovel", used: 0, availableRound: 0 },
	];
	knifeState.players[2].cards = [{ id: "torch", used: 0, availableRound: 0 }];
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(knifeState, 0));
	await page.locator(".equipment-list button").filter({ hasText: "Pocketknife" }).click();
	const copies = page.getByRole("group", { name: "Copy equipment" });
	if ((await copies.getByRole("button").count()) !== 2)
		throw Error("Copy options must only show equipment usable in this phase");
	await copies.getByRole("button", { name: /Shovel/ }).click();
	await page.getByRole("group", { name: "New value" }).getByRole("button").nth(5).click();
	if (await page.locator("select").count()) throw Error("Gameplay should expose choices without dropdowns");
	await page.screenshot({ path: "work/browser/fuji-copy-equipment.png", fullPage: true });
	knifeState.players[1].cards = [];
	knifeState.revision++;
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(knifeState, 0));
	const unavailableKnife = page.locator(".equipment-list button").filter({ hasText: "Pocketknife" });
	if ((await unavailableKnife.getAttribute("class")).includes("usable"))
		throw Error("Pocketknife advertised with no eligible copy target");
	await unavailableKnife.click();
	if (!(await page.getByRole("button", { name: "Use Pocketknife", exact: true }).isDisabled()))
		throw Error("Empty copy action must be disabled");

	s.phase = "movement";
	s.activeResolution = null;
	s.players[1].powerBars = 2;
	s.players[0].bonus += 3 - comparison(s, 0).margin;
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
	await page.locator(".comparison").getByText("ⓘ Stamina cost", { exact: true }).click();
	const staminaGuide = page.locator(".comparison .stamina-guide");
	if (!(await staminaGuide.locator("tr.current").innerText()).includes("3–4"))
		throw Error("Wrong highlighted stamina range");
	await page.screenshot({ path: "work/browser/fuji-stamina-guide.png", fullPage: true });
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
	if (await page.getByRole("button", { name: /Use 1 bar/ }).count())
		throw Error("Ineffective bar amount should be hidden");
	await page.getByRole("button", { name: /Use 2 bars/ }).click();
	const helpMove = await page.evaluate(() => window.captured.findLast((e) => e.name === "move")?.payload);
	s = applyMove(s, helpMove, 1);
	if (!s.players[0].resolved || s.players[1].powerBars !== 0) throw Error("Help did not resolve movement");
	await page.evaluate((v) => window.bridge.emit("state", v), stripSecret(s, 1));
	await page.getByRole("button", { name: "Journal", exact: true }).click();
	await page.locator(".journey-log summary").first().click();
	await page.locator(".journey-log[open] .journal-dice .die").first().waitFor();
	await page.getByRole("heading", { name: "Round 01", exact: true }).waitFor();
	await page.getByRole("heading", { name: "Preparation", exact: true }).waitFor();
	await page.screenshot({ path: "work/browser/fuji-compact-journal.png", fullPage: true });
	const closeBeforeScroll = await page.getByRole("button", { name: "Collapse journal" }).boundingBox();
	await page.locator(".inline-journal ol").evaluate((list) => (list.scrollTop = list.scrollHeight));
	const closeAfterScroll = await page.getByRole("button", { name: "Collapse journal" }).boundingBox();
	if (closeAfterScroll.y !== closeBeforeScroll.y) throw Error("Journal close button scrolled away");
	await page.screenshot({ path: "work/browser/fuji-dice-journal.png", fullPage: true });
	await page.getByRole("button", { name: "Collapse journal" }).click();
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
