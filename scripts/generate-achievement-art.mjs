// Original geometric expedition artwork. AGPL-3.0-only; no publisher artwork inputs.
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { SCENARIOS } from "../packages/engine/dist/src/data.js";
import { achievementDefinitions } from "../packages/engine/dist/src/achievements.js";

const out = new URL("../work/achievement-art/", import.meta.url);
await mkdir(out, { recursive: true });
const ink = "#102f38",
	teal = "#71d4be",
	gold = "#ffdb85",
	red = "#f77b58",
	cream = "#fff2ce";
const path = (d, fill, stroke = "none", width = 2) =>
	`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const rect = (x, y, w, h, fill, rx = 1) =>
	`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const person = (x, y, s = 1, color = cream) =>
	`<g transform="translate(${x} ${y}) scale(${s})">${circle(0, -9, 4, color)}${path("M-5 -2 Q0 -5 5 -2 L7 9 H3 L2 16 H-2 L-3 9 H-7 Z", color)}${rect(-8, -1, 3, 9, gold)}</g>`;
const gate = (x, y, s = 1) =>
	`<g transform="translate(${x} ${y}) scale(${s})">${path("M-22 -10 L0 -22 L22 -10 Z", teal)}${rect(-18, -8, 6, 31, teal)}${rect(12, -8, 6, 31, teal)}${rect(-22, 20, 44, 4, teal)}</g>`;
const volcano = (x, y, s = 1) =>
	`<g transform="translate(${x} ${y}) scale(${s})">${path("M-22 16 L-7 -13 H7 L22 16 Z", red)}${path("M-7 -13 L-4 -3 L1 -8 L7 -2 L7 -13 Z", gold)}${path("M-4 -19 L-7 -26 M5 -20 L10 -27", "none", red, 3)}</g>`;
const reserve = (x, y, w, filled) =>
	rect(x, y, w, 10, cream, 3) + rect(x + 2, y + 2, w - 4, 6, ink, 2) + rect(x + 2, y + 2, (w - 4) * filled, 6, teal, 2);
const motifs = {
	"escape-together": () =>
		volcano(30, 39, 0.65) +
		gate(68, 49, 0.85) +
		path("M22 78 Q37 91 74 78", "none", gold, 3) +
		person(38, 64, 0.6) +
		person(53, 66, 0.6) +
		person(68, 64, 0.6),
	"difficulty-2-escape": () =>
		volcano(31, 35, 0.8) +
		path("M20 49 L42 46 L55 65 L44 76 L23 69 Z", red) +
		path("M50 82 Q81 68 72 40", "none", teal, 9) +
		person(69, 58, 0.72),
	"difficulty-3-escape": () =>
		volcano(48, 28, 0.6) +
		path("M15 40 L31 35 L42 54 L32 66 L40 82 L22 74 Z", red) +
		path("M82 38 L68 41 L61 54 L70 66 L61 82 L82 73 Z", red) +
		path("M48 86 L48 44", "none", teal, 6) +
		person(47, 55, 0.65) +
		person(49, 75, 0.55),
	"difficulty-4-escape": () =>
		path("M18 75 Q3 44 26 23 Q51 6 77 25 Q97 48 82 76 L70 68 Q82 44 64 34 Q44 22 30 39 Q18 53 30 67 Z", red) +
		gate(51, 50, 0.65) +
		path("M50 88 V67", "none", gold, 8) +
		person(50, 72, 0.6) +
		path("M19 48 L26 53 M75 40 L82 36 M66 24 L65 31", "none", gold, 3),
	"strength-to-spare": () =>
		person(31, 47, 0.8) +
		person(51, 43, 1) +
		person(71, 47, 0.8) +
		reserve(23, 73, 54, 0.8) +
		path("M27 24 L34 16 M73 24 L66 16", "none", gold, 3),
	"unscathed-team": () =>
		path("M50 15 L82 28 L79 59 Q75 77 50 88 Q25 77 21 59 L18 28 Z", "none", teal, 4) +
		person(34, 49, 0.75) +
		person(65, 49, 0.75) +
		person(50, 58, 0.8) +
		path("M40 26 L47 33 L61 22", "none", gold, 4),
	"narrow-escape": () =>
		gate(65, 46, 0.8) +
		path("M19 79 L37 66 L47 72 L52 62", "none", gold, 3) +
		`<g transform="rotate(18 44 54)">${person(44, 54, 0.9)}</g>` +
		reserve(24, 84, 49, 0.15),
	"well-equipped": () =>
		rect(57, 25, 23, 40, cream, 3) +
		path("M62 31 H75 M62 37 H75", "none", ink, 2) +
		path("M31 35 V28 Q31 18 43 18 Q55 18 55 28 V35", "none", teal, 5) +
		rect(24, 33, 41, 48, teal, 9) +
		rect(28, 47, 33, 25, ink, 5) +
		rect(31, 39, 5, 13, gold) +
		rect(53, 39, 5, 13, gold) +
		circle(45, 60, 9, cream) +
		path("M45 53 L49 63 L41 63 Z", red) +
		path("M73 53 Q89 61 78 77 Q69 85 63 76 Q58 67 69 63 Q79 61 77 70 Q76 76 70 73", "none", gold, 3),
	"four-to-safety": () =>
		gate(50, 30, 0.9) +
		path("M18 56 V77 Q50 96 82 77 V56", "none", teal, 4) +
		person(28, 62, 0.64) +
		person(43, 62, 0.64) +
		person(58, 62, 0.64) +
		person(73, 62, 0.64),
};
function scenario(n) {
	const rows = SCENARIOS[n - 1],
		pitch = 8,
		x0 = 22,
		y0 = 24;
	let body = "";
	// Preserve every source coordinate, including optional V4 (hollow village node).
	for (let y = 0; y < rows.length; y++)
		for (let x = 0; x < rows[y].length; x++) {
			const c = rows[y][x];
			if (c === " ") continue;
			const px = x0 + x * pitch,
				py = y0 + y * pitch;
			for (const [dx, dy] of [
				[1, 0],
				[0, 1],
			])
				if (rows[y + dy]?.[x + dx] && rows[y + dy][x + dx] !== " ")
					body += path(`M${px} ${py} l${dx * pitch} ${dy * pitch}`, "none", "#527a7b", 3);
		}
	for (let y = 0; y < rows.length; y++)
		for (let x = 0; x < rows[y].length; x++) {
			const c = rows[y][x],
				px = x0 + x * pitch,
				py = y0 + y * pitch;
			if (c === " ") continue;
			if (c === "V") body += path(`M${px - 4} ${py + 3} L${px - 1} ${py - 4} H${px + 1} L${px + 4} ${py + 3} Z`, red);
			else if (c.startsWith("v") || c === "V4")
				body += path(
					`M${px - 3} ${py + 3} V${py - 1} L${px} ${py - 4} L${px + 3} ${py - 1} V${py + 3} Z`,
					c === "V4" ? ink : teal,
					teal,
					1
				);
			else if (c.startsWith("S")) body += circle(px, py, 3.4, gold) + circle(px, py, 1.2, ink);
			else if (c === "R") body += path(`M${px - 3} ${py + 2} L${px - 1} ${py - 3} L${px + 3} ${py + 2} Z`, red);
			else body += rect(px - 2.8, py - 2.8, 5.6, 5.6, cream, 1);
		}
	return body + path("M41 89 L47 93 L58 86", "none", gold, 2.5);
}
const hash = (data) => createHash("sha256").update(data).digest("hex");
const assets = [];
for (const { id, icon } of achievementDefinitions().achievements) {
	const n = /^scenario-(\d)-escape$/.exec(id)?.[1];
	const body = n ? scenario(Number(n)) : motifs[id]();
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100"><circle cx="50" cy="50" r="49" fill="${ink}"/><circle cx="50" cy="50" r="46" fill="none" stroke="#7ea99e" stroke-width="1"/>${body}</svg>`;
	const png = await sharp(Buffer.from(svg)).png().toBuffer();
	await writeFile(new URL(`${icon.key}.svg`, out), svg + "\n");
	await writeFile(new URL(`${icon.key}.png`, out), png);
	assets.push({
		id,
		key: icon.key,
		svg: `${icon.key}.svg`,
		png: `${icon.key}.png`,
		sourceSha256: hash(svg + "\n"),
		pngSha256: hash(png),
		provenance: n
			? `Original geometric rendering of SCENARIOS[${Number(n) - 1}] coordinates in packages/engine/src/data.ts; no source illustrations copied.`
			: "Original expedition geometry authored in scripts/generate-achievement-art.mjs; no external art.",
		license: "AGPL-3.0-only",
	});
}
for (const [theme, bg, fg] of [
	["light", "#f8f4e9", ink],
	["dark", "#081b22", cream],
])
	for (const size of [32, 48, 64, 128]) {
		const cellW = 230,
			cellH = size + 40,
			w = cellW * 4,
			h = cellH * 4;
		const layers = [];
		for (const [i, a] of assets.entries()) {
			const x = (i % 4) * cellW,
				y = Math.floor(i / 4) * cellH;
			layers.push({
				input: await sharp(new URL(a.png, out).pathname).resize(size, size).toBuffer(),
				left: x + Math.floor((cellW - size) / 2),
				top: y + 6,
			});
			layers.push({
				input: Buffer.from(
					`<svg width="230" height="25"><text x="115" y="15" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${fg}">${a.id}</text></svg>`
				),
				left: x,
				top: y + size + 10,
			});
		}
		await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
			.composite(layers)
			.png()
			.toFile(new URL(`contact-${theme}-${size}.png`, out).pathname);
	}
await writeFile(
	new URL("manifest.json", out),
	JSON.stringify(
		{
			game: "fuji",
			engineVersion: "0.1.14",
			manifestRevision: 2,
			dimensions: [512, 512],
			generatorSha256: hash(await readFile(new URL(import.meta.url))),
			dataSha256: hash(await readFile(new URL("../packages/engine/src/data.ts", import.meta.url))),
			assets,
		},
		null,
		2
	) + "\n"
);
console.log(`Generated ${assets.length} assets and 8 contact sheets in ${out.pathname}`);
