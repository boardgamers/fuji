import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

async function recordPresentation(page) {
	await page.evaluate(() => {
		const frames = [];
		const record = () => {
			const frame = {
				positions: Array.from(document.querySelectorAll(".traveler"), (el) => el.style.transform),
				lava: document.querySelectorAll(".location.lava").length,
				complete: document.querySelector(".bgs-tutorial-heading strong")?.textContent === "Chapter complete",
				celebrating: !!document.querySelector(".victory-petals"),
			};
			if (JSON.stringify(frame) !== JSON.stringify(frames.at(-1))) frames.push(frame);
		};
		record();
		const observer = new MutationObserver(record);
		observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
		window.readTutorialFrames = () => {
			record();
			observer.disconnect();
			return frames;
		};
	});
}

async function finishRound(page) {
	await recordPresentation(page);
	await page.locator('[data-tutorial="resolve"]:visible').first().click();
	await page.getByText("Chapter complete", { exact: true }).waitFor();
	const frames = await page.evaluate(() => window.readTutorialFrames());
	const first = frames[0];
	const last = frames.at(-1);
	assert.ok(last.lava > first.lava, "The round ends with lava spreading");
	for (const seat of [0, 1, 2]) {
		assert.notEqual(last.positions[seat], first.positions[seat], `Explorer ${seat} moves`);
		assert.ok(
			frames.some((f) => !f.complete && f.positions[seat] === last.positions[seat] && f.lava === first.lava),
			`Explorer ${seat}'s move is presented before the lava and completion`
		);
	}
	assert.ok(
		frames.some((f) => !f.complete && f.lava === last.lava),
		"The guide waits for the lava animation"
	);
}

const server = createServer(async (req, res) => {
	if (req.url === "/fuji-viewer.iife.js" || req.url === "/fuji-viewer.css") {
		res.setHeader(
			"content-type",
			req.url.endsWith("css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8"
		);
		res.end(await readFile(new URL(`../packages/viewer/dist${req.url}`, import.meta.url)));
	} else {
		res.setHeader("content-type", "text/html; charset=utf-8");
		res.end(
			`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fuji-viewer.css"><div id="app"></div><script src="/fuji-viewer.iife.js"></script><script>fuji.launchTutorial('#app', {chapter:new URLSearchParams(location.search).get('chapter') || 'first-steps'});</script>`
		);
	}
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.FUJI_CHROMIUM_EXECUTABLE });
const chapterFilter = process.env.FUJI_TUTORIAL_CHAPTER;
try {
	for (const viewport of [
		{ width: 1440, height: 1000 },
		{ width: 390, height: 844 },
	].filter(() => !chapterFilter || chapterFilter === "first-steps")) {
		const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
		const page = await context.newPage();
		const errors = [];
		page.on("pageerror", (e) => errors.push(e.message));
		await page.goto(url);
		const guide = page.locator(".bgs-tutorial-guide");
		const step = (number) =>
			page.waitForFunction(
				(n) => document.querySelector(".bgs-tutorial-heading strong")?.textContent.startsWith(`${n}/8`),
				number
			);
		await step(1);
		assert.equal(await page.locator(".dev-toolbar, .expedition-chat").count(), 0);
		await guide.getByRole("button", { name: "Continue", exact: true }).click();
		await step(2);
		await guide.getByRole("button", { name: "Show area", exact: true }).click();
		await page.locator('[data-tutorial="tile:1,3"]').click();
		await step(3);
		await guide.getByRole("button", { name: "Continue", exact: true }).click();
		await step(4);
		await page.locator('[data-tutorial="confirm"]:visible').first().click();
		await step(5);
		await page.reload();
		await step(5);
		await guide.getByRole("button", { name: "Show area", exact: true }).click();
		for (const index of [3, 4, 5]) await page.locator(".personal .dice-row .die").nth(index).click();
		await page.getByRole("button", { name: /Reroll 3 dice/ }).click();
		await step(6);
		await page.reload();
		await step(6);
		assert.match(await guide.innerText(), /pink 5/);
		await guide.getByRole("button", { name: "Show area", exact: true }).click();
		await page.locator(".personal .die.bgs-tutorial-highlight").click();
		await page.getByRole("button", { name: "Set die aside · free", exact: true }).click();
		await step(7);
		await page.locator('[data-tutorial="confirm"]:visible').first().click();
		await step(8);
		assert.equal(await page.locator("details.revealed-log").count(), 0);
		await page.getByRole("button", { name: "Expand journal", exact: true }).first().click();
		assert.ok((await page.locator(".revealed-log .die").count()) > 0);
		await finishRound(page);
		await page.waitForFunction(
			() => document.querySelector(".bgs-tutorial-heading strong")?.textContent === "Chapter complete"
		);
		assert.match(await guide.innerText(), /You reached Hilltop lookout/);
		assert.equal(await guide.getByRole("button", { name: "Continue", exact: true }).isEnabled(), false);
		await page.reload();
		await page.waitForFunction(
			() => document.querySelector(".bgs-tutorial-heading strong")?.textContent === "Chapter complete"
		);
		await guide.getByRole("button", { name: "Back to start", exact: true }).click();
		await step(1);
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
		assert.deepEqual(errors, []);
		await context.close();
	}
	for (const width of [1440, 390]) {
		for (const chapter of ["equipment", "terrain-bonuses", "lava"].filter(
			(id) => !chapterFilter || chapterFilter === id
		)) {
			const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
			const errors = [];
			page.on("pageerror", (e) => errors.push(e.message));
			await page.goto(`${url}/?chapter=${chapter}`);
			const guide = page.locator(".bgs-tutorial-guide");
			const step = (n) =>
				guide
					.locator(".bgs-tutorial-heading strong")
					.filter({ hasText: new RegExp(`^${n}/`) })
					.waitFor();
			const next = () => guide.getByRole("button", { name: "Continue", exact: true }).click();
			const confirm = () => page.locator('[data-tutorial="confirm"]:visible').first().click();
			await step(1);
			if (chapter === "equipment") {
				await next();
				await step(2);
				await page.locator('[data-tutorial="equipment:shovel"]').click();
				const faces = page.getByRole("group", { name: "New value" });
				assert.equal(await faces.count(), 0, "Choose a die before showing its possible faces");
				await page.locator('[data-tutorial="die:0-0"]').click();
				assert.match(await faces.locator(".die").first().getAttribute("aria-label"), /^blue 1/);
				await page.locator('[data-tutorial="die:0-3"]').click();
				assert.equal(await page.locator(".personal .die.chosen").count(), 1);
				assert.deepEqual(
					await faces.locator(".die").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label"))),
					["yellow 1", "pink 2", "blue 3", "blue 4", "pink 5", "yellow 6"]
				);
				await faces.locator(".die").nth(5).click();
				await page.getByRole("button", { name: "Use Shovel", exact: true }).click();
				await step(3);
				await page.reload();
				await step(3);
				await page.locator('[data-tutorial="equipment:map"]').click();
				await page.locator('[data-tutorial="die:0-5"]').click();
				await page.getByRole("group", { name: "Lend a die to" }).getByRole("button", { name: /Ren/ }).click();
				await page.getByRole("button", { name: "Use Map", exact: true }).click();
				await step(4);
				await confirm();
				await step(5);
				await finishRound(page);
			} else if (chapter === "terrain-bonuses") {
				await page.locator('[data-tutorial="tile:1,3"]').click();
				await step(2);
				await confirm();
				await step(3);
				await page.locator('[data-tutorial="die:0-4"]').click();
				await page.locator('[data-tutorial="die:0-5"]').click();
				await page.getByRole("button", { name: /Reroll 2 dice/ }).click();
				await step(4);
				assert.match(await guide.innerText(), /last die is now a matching 1/);
				await page.locator('[data-tutorial="die:0-4"]').click();
				await page.getByRole("button", { name: /Reroll 1 die/ }).click();
				await step(5);
				await confirm();
				await step(6);
				await finishRound(page);
			} else {
				await next();
				await step(2);
				await page.reload();
				await step(2);
				await recordPresentation(page);
				await confirm();
				await guide.getByText("Chapter complete", { exact: true }).waitFor();
				const frames = await page.evaluate(() => window.readTutorialFrames());
				const counts = [...new Set(frames.map((f) => f.lava))];
				assert.equal(counts.length, 3, "Two separate lava waves are animated");
				for (const count of counts.slice(1)) {
					assert.ok(
						frames.some((f) => !f.complete && f.lava === count),
						"Each wave appears before completion"
					);
				}
				const expandJournal = page.getByRole("button", { name: "Expand journal", exact: true }).first();
				if (await expandJournal.isVisible()) await expandJournal.click();
				assert.match(await page.locator('[data-tutorial="journal"]').innerText(), /Mika was caught by the lava/);
			}
			await guide.getByText("Chapter complete", { exact: true }).waitFor();
			assert.equal(await guide.getByRole("button", { name: "Continue", exact: true }).isEnabled(), false);
			if (chapter === "terrain-bonuses") {
				assert.match(await page.locator('[data-tutorial="equipment:rope"]').innerText(), /Available now/);
			}
			await page.reload();
			await guide.getByText("Chapter complete", { exact: true }).waitFor();
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
			assert.deepEqual(errors, []);
			await page.close();
		}
	}
	for (const { width, reducedMotion } of [
		{ width: 1440, reducedMotion: "reduce" },
		{ width: 390, reducedMotion: "reduce" },
		{ width: 1440, reducedMotion: "no-preference" },
		{ width: 390, reducedMotion: "no-preference" },
	].filter(() => !chapterFilter || chapterFilter === "village")) {
		const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion });
		await page.goto(`${url}/?chapter=village`);
		const guide = page.locator(".bgs-tutorial-guide");
		await guide.getByRole("button", { name: "Continue", exact: true }).click();
		await guide.getByText("2/5 · Choose Village street", { exact: true }).waitFor();
		await page.locator('[data-tutorial="tile:4,1"]').click();
		await guide.getByText("3/5 · Confirm your destination", { exact: true }).waitFor();
		const confirm = () => page.locator('[data-tutorial="confirm"]:visible').first().click();
		await confirm();
		await guide.getByText("4/5 · Keep these strong dice", { exact: true }).waitFor();
		await guide.getByRole("button", { name: "Previous step", exact: true }).click();
		await guide.getByText("3/5 · Confirm your destination", { exact: true }).waitFor();
		await page.reload();
		await guide.getByText("3/5 · Confirm your destination", { exact: true }).waitFor();
		await confirm();
		await guide.getByText("4/5 · Keep these strong dice", { exact: true }).waitFor();
		await page.locator('[data-tutorial="finish-rerolls"]:visible').first().click();
		await guide.getByText("5/5 · Bring everyone home", { exact: true }).waitFor();
		assert.equal(await page.locator(".victory-petals").count(), 0);
		await recordPresentation(page);
		await confirm();
		await guide.getByText("Chapter complete", { exact: true }).waitFor();
		if (reducedMotion === "no-preference") await page.locator(".victory-petals").waitFor();
		const frames = await page.evaluate(() => window.readTutorialFrames());
		for (const seat of [0, 1, 2]) {
			assert.notEqual(frames[0].positions[seat], frames.at(-1).positions[seat]);
			assert.ok(
				frames.some((f) => !f.complete && f.positions[seat] === frames.at(-1).positions[seat]),
				"Moves are shown before chapter completion"
			);
		}
		assert.equal(frames[0].lava, frames.at(-1).lava, "Victory needs no further lava wave");
		assert.match(await guide.innerText(), /whole team wins immediately/);
		const bounds = await guide
			.locator(".bgs-tutorial-playback button:visible")
			.evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().top));
		assert.equal(new Set(bounds).size, 1, "Playback controls stay on one row");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
		if (reducedMotion === "no-preference") {
			await page.locator(".victory-petals").waitFor();
			assert.equal(await page.locator(".victory-petals .petal").count(), 36);
			assert.ok(
				frames.some((f) => f.celebrating),
				"The victory starts the petal effect"
			);
			assert.equal(await page.locator(".victory-petals").evaluate((el) => getComputedStyle(el).pointerEvents), "none");
			assert.ok(
				frames
					.filter((f) => f.celebrating)
					.every((f) => JSON.stringify(f.positions) === JSON.stringify(frames.at(-1).positions)),
				"Petals follow every explorer's movement"
			);
			await page.waitForTimeout(1600);
			await page.screenshot({ path: `/tmp/fuji-victory-petals-${width}.png` });
			await page.locator(".victory-petals").waitFor({ state: "detached", timeout: 7000 });
		} else {
			assert.equal(await page.locator(".victory-petals").count(), 0, "Respect reduced motion");
		}
		await page.screenshot({ path: `/tmp/fuji-village-${width}.png`, fullPage: true });
		await page.reload();
		await guide.getByText("Chapter complete", { exact: true }).waitFor();
		assert.equal(
			await page.locator(".victory-petals").count(),
			0,
			"Refreshing a finished game does not celebrate again"
		);
		await page.close();
	}
	console.log(
		chapterFilter
			? `Fuji tutorial ${chapterFilter}: desktop/mobile checks passed.`
			: "Fuji tutorials: all five chapters complete on desktop/mobile, with reload, equipment, lava and visible dice logs."
	);
} finally {
	await browser.close();
	await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
