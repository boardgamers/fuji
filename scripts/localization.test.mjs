import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../packages/viewer/src/localization/runtime.js", import.meta.url), "utf8");
const { createTranslator, resolveLocale } = await import(
	"data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const catalogs = {
	nl: {
		Draw: "Tekenen",
		"Your cash: $": "Je geld: $",
		Ore: "Erts",
		east: "oost",
		"{p0} · ◈ {p1}": "{p0} · ◈ {p1}",
		Round: "Ronde",
		"Build {p0} for {p1}": "Bouw voor {p1}: {p0}",
		"{p0} buys {p1}": "{p0} koopt {p1}",
		"Make money by trading": "Verdien geld door te handelen",
		"Gain {p0} points{p1}": "Krijg {p0} punten{p1}",
	},
	fr: { Round: "Manche" },
};
test("regional language preferences select supported catalogues", () => {
	assert.equal(resolveLocale("nl-BE"), "nl");
	assert.equal(resolveLocale("pt-PT"), "pt-BR");
	assert.equal(resolveLocale("zh-Hant-TW"), "zh-TW");
	assert.equal(resolveLocale("zh-CN"), "en");
	assert.equal(resolveLocale(undefined), "en");
});
test("dynamic values are reordered while player names stay unchanged", () => {
	const t = createTranslator(catalogs, "nl");
	t.setNames(["Draw"]);
	assert.equal(t.translate("Draw buys 3"), "Draw koopt 3");
	assert.equal(t.translate("Build 2 for 10"), "Bouw voor 10: 2");
	assert.equal(t.translate("Draw"), "Draw");
	assert.equal(t.translate("Gain 2 points"), "Krijg 2 punten");
});
test("tutorial numbering and whitespace survive translation", () => {
	const t = createTranslator(catalogs, "nl");
	assert.equal(t.translate("  1/5 · Make money by trading\n"), "  1/5 · Verdien geld door te handelen\n");
	assert.equal(t.translate("Round 2"), "Ronde 2");
	assert.equal(t.translate("Unknown sentence"), "Unknown sentence");
});
test("language changes clear caches and preserve the English fallback", () => {
	const t = createTranslator(catalogs, "nl");
	assert.equal(t.translate("Round"), "Ronde");
	t.setLocale("fr");
	assert.equal(t.translate("Round"), "Manche");
	t.setLocale("en");
	assert.equal(t.translate("Round"), "Round");
});

test("icon-separated values and uppercase labels are localized", () => {
	const t = createTranslator(catalogs, "nl");
	assert.equal(t.translate("Ore · ◈ 10"), "Erts · ◈ 10");
	assert.equal(t.translate("EAST"), "OOST");
});

test("decorative arrows and attached currency values keep their meaning", () => {
	const t = createTranslator(catalogs, "nl");
	assert.equal(t.translate("Draw →"), "Tekenen →");
	assert.equal(t.translate("Your cash: $20"), "Je geld: $20");
});

test("Fuji tutorial headings beat generic fragments and plurals stay whole", async () => {
	const locales = {};
	for (const lang of ["en", "fr", "zh-TW", "vi"]) {
		locales[lang] = JSON.parse(
			await readFile(new URL(`../packages/viewer/src/localization/${lang}.json`, import.meta.url), "utf8")
		);
	}
	const fr = createTranslator(locales, "fr");
	assert.equal(fr.translate("1/3 · Your first journey"), `1/3 · ${locales.fr["Your first journey"]}`);
	assert.equal(fr.translate("2 steps"), "2 cases");
	assert.equal(
		fr.translate("Eruption: entering or crossing triggers 2 extra eruptions. One-time trigger."),
		"Éruption : entrer ou traverser déclenche 2 éruptions supplémentaires. Une seule fois."
	);
	const zh = createTranslator(locales, "zh-TW");
	assert.equal(zh.translate("Choose 2 of your 3 equipment cards to keep."), "從你的 3 張裝備卡中選擇 2 張保留。");
});

test("Persian uses regional tags and keeps dynamic game values and names intact", async () => {
	assert.equal(resolveLocale("fa-IR"), "fa");
	assert.equal(resolveLocale("FA_IR"), "fa");
	const fa = JSON.parse(
		await readFile(new URL("../packages/viewer/src/localization/fa.json", import.meta.url), "utf8")
	);
	const t = createTranslator({ fa }, "fa-IR");
	t.setNames(["Map"]);
	assert.equal(t.translate("Map gave Rope to Ren."), "Map وسیلهٔ طناب را به Ren داد.");
	assert.equal(t.translate("Use 2 bars · total 18"), "مصرف 2 خوراکی · مجموع 18");
	assert.equal(
		t.translate("Scenario 3 · Level 2. Everyone must reach a house-marked location."),
		"سناریوی 3 · سطح 2. همه باید به مکانی با نشان خانه برسند."
	);
	assert.equal(t.translate("translate(120,0)"), "translate(120,0)");
	assert.equal(t.translate("Map"), "Map");
	t.setLocale("en");
	assert.equal(t.translate("Use 2 bars · total 18"), "Use 2 bars · total 18");
});
