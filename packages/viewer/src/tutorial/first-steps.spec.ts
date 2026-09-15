import { test } from "node:test";
import assert from "node:assert/strict";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { stripSecret, total, cell } from "fuji-engine";
import { firstSteps, DESTINATION, buddyChoices } from "./first-steps.ts";

test("every allowed reroll choice completes the first chapter with legal engine moves", async () => {
	for (let subset = 1; subset < 8; subset++) {
		const c = await createTutorial(firstSteps);
		assert.ok(stripSecret(c.snapshot.state, 0).players[1]!.dice.every((d) => d.face === 0));
		await c.continue();
		assert.equal(await c.play({ action: "ready" }), false);
		assert.equal(await c.play({ action: "plan", path: ["0,3", DESTINATION] }), true);
		await c.continue();
		await c.play({ action: "ready" });
		assert.equal(c.snapshot.state.phase, "reroll");
		assert.equal(await c.play({ action: "reroll", ids: ["0-0"] }), false);
		await c.play({ action: "reroll", ids: ["0-3", "0-4", "0-5"].filter((_, i) => subset & (1 << i)) });
		const before = c.snapshot.state;
		const ownTotal = total(before.players[0]!, 8);
		const renTile = cell(before, before.players[2]!.path.at(-1)!).terrain;
		const renConflict = total(before.players[0]!, renTile);
		const die = buddyChoices(before)[0]!;
		assert.equal(die.face, 5);
		assert.equal(await c.play({ action: "finishRerolls" }), false);
		assert.equal(await c.play({ action: "buddy", ids: ["0-0"] }), false);
		assert.equal(await c.play({ action: "buddy", ids: [die.id] }), true, c.snapshot.error);
		assert.equal(c.snapshot.state.phase, "equipment");
		assert.equal(total(c.snapshot.state.players[0]!, 8), ownTotal);
		assert.equal(total(c.snapshot.state.players[0]!, renTile), renConflict - 5);
		assert.ok(stripSecret(c.snapshot.state, 1).players[0]!.dice.find((d) => d.id === die.id)?.face === 5);
		await c.play({ action: "ready" });
		assert.equal(c.snapshot.state.phase, "movement");
		assert.ok(stripSecret(c.snapshot.state, 0).players[1]!.dice.every((d) => d.face > 0));
		await c.play({ action: "beginMovement" });
		assert.equal(c.snapshot.state.players[0]!.position, DESTINATION);
		assert.equal(c.snapshot.state.players[0]!.stamina, 2);
		assert.ok(c.snapshot.state.log.some((e) => e.text === "Ren rerolled."));
		const journeys = c.snapshot.state.log.flatMap((e) => (e.journey ? [e.journey] : []));
		assert.deepEqual(
			journeys.map((j) => j.name),
			["You", "Mika", "Ren"]
		);
		assert.ok(journeys.every((j) => j.moved));
		assert.ok(journeys[1]!.own >= 10);
		assert.ok(journeys[2]!.own >= 15);
		assert.equal(c.snapshot.state.round, 2);
		assert.ok(c.snapshot.state.log.some((e) => e.animation?.kind === "eruption"));
		assert.equal(c.snapshot.canContinue, false);
		assert.equal(c.snapshot.completed, true, c.snapshot.error);
	}
});

test("reloading and retrying a reroll reproduces the same roll without changing live-game state", async () => {
	const records = new Map<string, string>();
	const options = {
		...firstSteps,
		storage: {
			getItem: (k: string) => records.get(k) ?? null,
			setItem: (k: string, v: string) => {
				records.set(k, v);
			},
		},
	};
	const c = await createTutorial(options);
	await c.continue();
	await c.play({ action: "plan", path: ["0,3", DESTINATION] });
	await c.continue();
	await c.play({ action: "ready" });
	const restored = await createTutorial(options);
	assert.deepEqual(restored.snapshot.state, c.snapshot.state);
	await c.play({ action: "reroll", ids: ["0-3", "0-4", "0-5"] });
	await restored.play({ action: "reroll", ids: ["0-3", "0-4", "0-5"] });
	assert.deepEqual(restored.snapshot.state, c.snapshot.state);
	const beforeBuddy = await createTutorial(options);
	assert.match(beforeBuddy.snapshot.text, /pink 5/);
	await beforeBuddy.play({ action: "buddy", ids: [buddyChoices(beforeBuddy.snapshot.state)[0]!.id] });
	const afterBuddy = await createTutorial(options);
	assert.deepEqual(afterBuddy.snapshot.state, beforeBuddy.snapshot.state);
	assert.equal(afterBuddy.snapshot.state.players[0]!.buddyUsed, true);
	assert.equal(records.size, 1);
	assert.ok(records.has("bgs:tutorial:fuji:first-steps"));
});
