import { chromium } from "playwright";
import fs from "node:fs";
import { initGame } from "../packages/engine/dist/index.js";
fs.mkdirSync("work/browser", { recursive: true });

(async () => {
	const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
	await page.addInitScript(
		(game) => {
			localStorage.setItem("fuji-dev-v1", JSON.stringify(game));
		},
		initGame(3, { skillAssignment: "fixed" }, "first-light")
	);
	await page.goto("http://127.0.0.1:5187");
	await page.waitForSelector(".map");
	if (
		!(await page
			.locator(".pack-options")
			.getByText(/do not count in movement comparisons/)
			.isVisible())
	)
		throw Error("Equipment effect must be readable during preparation");
	const beforePreview = await page.evaluate(() => localStorage.getItem("fuji-dev-v1"));
	await page.locator(".location").first().hover();
	await page.locator(".location").first().dispatchEvent("click");
	if (await page.locator(".location.selected").count()) throw Error("Preparation preview looks selected");
	if (beforePreview !== (await page.evaluate(() => localStorage.getItem("fuji-dev-v1"))))
		throw Error("Preview changed game state");
	await page.screenshot({ path: "work/browser/fuji-setup.png", fullPage: true });
	if (await page.getByRole("button", { name: "Ready for the journey" }).count())
		throw Error("Buddy must not need a preparation confirmation");
	await page.getByText("Playtest tools", { exact: true }).click();
	const step = page.getByRole("button", { name: "Play next teammate action" });
	await step.click();
	await page.getByRole("button", { name: "Skip to latest", exact: true }).waitFor({ state: "hidden", timeout: 60000 });
	const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("fuji-dev-v1")));
	let s = await state();
	if (s.phase !== "planning") throw Error("Setup did not finish");
	await page.locator(".location.reachable").nth(1).click();
	s = await state();
	if (s.players[0].path.length < 2 || s.players[0].ready) throw Error("Click must share route without confirming");
	if (await page.getByRole("button", { name: "Set this route" }).count()) throw Error("Redundant route confirmation");
	await page.getByRole("button", { name: "Ready to travel", exact: false }).first().waitFor();
	await page.locator(".personal-title").hover();
	const selectedTotal = await page.locator(".personal .dice-total").innerText();
	await page.locator(".location").last().hover();
	await page.locator(".personal-title").hover();
	if ((await page.locator(".personal .dice-total").innerText()) !== selectedTotal)
		throw Error("Leaving a tile must restore the selected destination total");
	await page.getByText("Playtest tools", { exact: true }).click();
	await page.screenshot({ path: "work/browser/fuji-planning.png", fullPage: true });
	await page.getByRole("button", { name: "Open playing guide" }).click();
	await page.keyboard.press("Escape");
	if (await page.getByRole("dialog").count()) throw Error("Escape did not close guide");
	await page.getByRole("button", { name: "Journal", exact: true }).click();
	if (!(await page.getByRole("region", { name: "Expedition journal" }).isVisible()))
		throw Error("Journal did not open");
	await page.getByRole("button", { name: "Collapse journal" }).click();
	if (await page.locator("#journal-entries").count()) throw Error("Journal did not collapse");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: "work/browser/fuji-mobile.png", fullPage: true });
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
	if (overflow) throw Error("Page overflows on mobile");
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.getByText("Playtest tools", { exact: true }).click();
	let count = 0;
	const phases = new Set();
	while (!(s = await state()).outcome && count < 450) {
		phases.add(s.phase);
		if (await page.getByRole("button", { name: "Resolve my journey" }).count())
			throw Error("New expeditions must not ask players to choose movement order");
		await step.click();
		if (await page.getByRole("button", { name: "Skip to latest", exact: true }).count())
			await page.getByRole("button", { name: "Skip to latest", exact: true }).click();
		count++;
		if (await page.locator(".error").count()) throw Error(await page.locator(".error").innerText());
	}
	console.log(
		JSON.stringify({
			errors,
			steps: count,
			phases: [...phases],
			outcome: s.outcome,
			round: s.round,
			reason: s.reason,
			mobileOverflow: overflow,
		})
	);
	if (errors.length || !s.outcome) throw Error("Playtest incomplete");
	await page.screenshot({ path: "work/browser/fuji-result.png", fullPage: true });
	const autoPage = await browser.newPage();
	await autoPage.goto("http://127.0.0.1:5187");
	await autoPage.getByText("Playtest tools", { exact: true }).click();
	const auto = autoPage.getByRole("checkbox", { name: "Automatically play teammates" });
	if (await auto.isChecked()) throw Error("Auto teammates should default off");
	await auto.check();
	await auto.uncheck();
	const pausedState = await autoPage.evaluate(() => localStorage.getItem("fuji-dev-v1"));
	await autoPage.waitForTimeout(900);
	if (pausedState !== (await autoPage.evaluate(() => localStorage.getItem("fuji-dev-v1"))))
		throw Error("Unchecking must cancel queued actions");
	await auto.check();
	await autoPage.waitForFunction(() => {
		const game = JSON.parse(localStorage.getItem("fuji-dev-v1"));
		return game.phase === "planning" && game.players.slice(1).every((p) => p.ready);
	});
	const autoState = await autoPage.evaluate(() => JSON.parse(localStorage.getItem("fuji-dev-v1")));
	if (autoState.players[0].ready || autoState.players[0].path.length !== 1)
		throw Error("Auto teammates played the user's seat");
	await auto.uncheck();
	await browser.close();
})();
