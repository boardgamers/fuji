import { chromium } from "playwright";
import fs from "node:fs";
fs.mkdirSync("work/browser", { recursive: true });

(async () => {
	const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
	const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
	const errors = [];
	page.on("pageerror", (e) => errors.push(e.message));
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
	await page.getByRole("button", { name: "Ready for the journey" }).click();
	await page.getByText("Playtest tools", { exact: true }).click();
	const step = page.getByRole("button", { name: "Play next teammate action" });
	await step.click();
	await step.click();
	const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("fuji-dev-v1")));
	let s = await state();
	if (s.phase !== "planning") throw Error("Setup did not finish");
	await page.locator(".location.reachable").nth(1).click();
	await page.getByRole("button", { name: "Set this route" }).click();
	await page.getByText("Playtest tools", { exact: true }).click();
	await page.screenshot({ path: "work/browser/fuji-planning.png", fullPage: true });
	await page.getByRole("button", { name: "Open playing guide" }).click();
	await page.keyboard.press("Escape");
	if (await page.getByRole("dialog").count()) throw Error("Escape did not close guide");
	await page.getByRole("button", { name: "Journal", exact: true }).click();
	if (!(await page.getByRole("dialog", { name: "Expedition journal" }).isVisible()))
		throw Error("Journal did not open");
	await page.keyboard.press("Escape");
	if (await page.getByRole("dialog").count()) throw Error("Escape did not close journal");
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
		await step.click();
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
	await browser.close();
})();
