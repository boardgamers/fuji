import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { achievementDefinitions } from "../packages/engine/dist/src/achievements.js";
import { SCENARIOS } from "../packages/engine/dist/src/data.js";
const root = new URL("../", import.meta.url),
	out = new URL("work/achievement-art/", root);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const source = await readFile(new URL("packages/engine/src/achievements.ts", root), "utf8");
const baseline = execFileSync(
	"git",
	["show", "cc865cfcbb9ba8920a647252a256e901b5f75fa4:packages/engine/src/achievements.ts"],
	{ encoding: "utf8" }
);
const withoutManifest = (s) =>
	s.replace(/export function achievementDefinitions\(\): AchievementManifest \{[\s\S]*?\n\}/, "MANIFEST");
assert.equal(
	withoutManifest(source),
	withoutManifest(baseline),
	"all IDs, metadata, predicates and evaluator unchanged"
);
const manifest = JSON.parse(await readFile(new URL("manifest.json", out)));
assert.deepEqual(
	manifest,
	JSON.parse(await readFile(new URL("docs/achievement-art/manifest.json", root))),
	"committed export manifest reproduces exactly"
);
const definitions = achievementDefinitions();
assert.equal(definitions.revision, 2);
assert.equal(definitions.achievements.length, 16);
assert.equal(manifest.generatorSha256, sha(await readFile(new URL("scripts/generate-achievement-art.mjs", root))));
assert.equal(manifest.dataSha256, sha(await readFile(new URL("packages/engine/src/data.ts", root))));
assert.deepEqual(
	manifest.assets.map((a) => a.id),
	definitions.achievements.map((a) => a.id)
);
const hashes = new Set();
for (const [i, a] of manifest.assets.entries()) {
	assert.deepEqual(definitions.achievements[i].icon, { type: "asset", key: a.key });
	assert.equal(a.key, `achievement-${a.id}`);
	const png = await readFile(new URL(a.png, out)),
		svg = await readFile(new URL(a.svg, out));
	assert.equal(sha(png), a.pngSha256);
	assert.equal(sha(svg), a.sourceSha256);
	const image = sharp(png),
		meta = await image.metadata();
	assert.equal(meta.width, 512);
	assert.equal(meta.height, 512);
	assert.equal(meta.format, "png");
	await image.raw().toBuffer();
	hashes.add(a.pngSha256);
	assert(a.provenance);
	assert.equal(a.license, "AGPL-3.0-only");
}
assert.equal(hashes.size, 16);
assert.equal(SCENARIOS.length, 7);
for (const theme of ["light", "dark"])
	for (const size of [32, 48, 64, 128])
		await sharp(new URL(`contact-${theme}-${size}.png`, out).pathname)
			.raw()
			.toBuffer();
console.log(
	"PASS: 16 unchanged award definitions/predicates/evaluator; 16 unique decoded 512px assets; all refs/hashes; 7 source topologies; 8 decoded contact sheets."
);
