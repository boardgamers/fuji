import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, symlink, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as source from "../packages/engine/dist/wrapper.js";
import { initGame } from "../packages/engine/dist/index.js";
const dir = new URL("../work/achievement-art/package/", import.meta.url);
const tarball = new URL("fuji-engine-0.1.14.tgz", dir);
await mkdir(new URL("unpacked/", dir), { recursive: true });
execFileSync("tar", ["-xzf", tarball.pathname, "-C", new URL("unpacked/", dir).pathname]);
await symlink(
	new URL("../packages/engine/node_modules/", import.meta.url).pathname,
	new URL("unpacked/package/node_modules", dir)
).catch((e) => {
	if (e.code !== "EEXIST") throw e;
});
const packed = await import(new URL("unpacked/package/dist/wrapper.js", dir));
assert.deepEqual(packed.achievementDefinitions(), source.achievementDefinitions());
const earned = new Set();
for (const [players, scenario, difficulty, seed] of [
	[2, 1, 1, 0],
	[2, 3, 1, 0],
	[2, 5, 1, 0],
	[2, 6, 1, 0],
	[3, 1, 2, 1],
	[3, 2, 2, 1],
	[3, 4, 2, 1],
	[3, 6, 2, 1],
	[4, 1, 3, 2],
	[2, 2, 4, 3],
	[2, 7, 3, 18],
]) {
	let s = initGame(players, { scenario, difficulty }, `achievement-${seed}`);
	for (let turn = 0; !s.outcome && turn < 1000; turn++) s = packed.moveAI(s, [packed.currentPlayer(s)].flat()[0]);
	assert.equal(s.outcome, "won");
	assert.deepEqual(packed.achievements(s), source.achievements(s));
	packed.achievements(s)[0].earned.forEach((id) => earned.add(id));
}
assert.equal(earned.size, 16);
console.log(
	`PASS exact packed hooks: 11 legal winning expeditions, all 16 awards. SHA256 ${createHash("sha256")
		.update(await readFile(tarball))
		.digest("hex")}`
);
