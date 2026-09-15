import { test } from "node:test";
import assert from "node:assert/strict";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { applyMove, cell, paths, stripSecret, terrain, threatened } from "fuji-engine";
import { equipmentLesson, terrainLesson, lavaLesson, BONUS_TILE, ERUPTION_TILE } from "./lessons.ts";

test("equipment teaches a legal turn and private loan, with cards discarded once", async () => {
	const c = await createTutorial(equipmentLesson);
	await c.continue();
	assert.equal(await c.play({ action: "ready" }), false);
	assert.equal(await c.play({ action: "equipment", id: "shovel", ids: ["0-3"], face: 6 }), true, c.snapshot.error);
	assert.equal(await c.play({ action: "equipment", id: "map", ids: ["0-5"], target: 1 }), false);
	assert.equal(await c.play({ action: "equipment", id: "map", ids: ["0-5"], target: 2 }), true, c.snapshot.error);
	assert.equal(stripSecret(c.snapshot.state, 1).players[2]!.dice.find((d) => d.id === "0-5")?.face, 0);
	assert.equal(stripSecret(c.snapshot.state, 2).players[2]!.dice.find((d) => d.id === "0-5")?.face, 5);
	assert.deepEqual(c.snapshot.state.discard.slice(-2), ["shovel", "map"]);
	await c.play({ action: "ready" });
	await c.play({ action: "beginMovement" });
	assert.equal(c.snapshot.state.players[0]!.position, "1,3");
	assert.equal(c.snapshot.state.players[0]!.stamina, 0);
	assert.equal(c.snapshot.state.round, 2);
	assert.equal(c.snapshot.state.log.filter((entry) => entry.journey?.moved).length, 3);
	assert.ok(
		c.snapshot.state.players[0]!.dice.some((d) => d.id === "0-5"),
		"The Map loan returns after lava"
	);
	assert.equal(c.snapshot.canContinue, false);
	assert.equal(c.snapshot.completed, true, c.snapshot.error);
});

test("the location bonus is granted before moving; the token grants next-round equipment on arrival", async () => {
	const c = await createTutorial(terrainLesson);
	await c.play({ action: "plan", path: ["0,3", BONUS_TILE] });
	await c.play({ action: "ready" });
	assert.equal(c.snapshot.state.players[0]!.rerolls, 2);
	assert.equal(c.snapshot.state.players[0]!.position, "0,3");
	assert.ok(cell(c.snapshot.state, BONUS_TILE).equipment);
	assert.equal(await c.play({ action: "reroll", ids: ["0-5"] }), false);
	await c.play({ action: "reroll", ids: ["0-4", "0-5"] });
	assert.equal(c.snapshot.state.players[0]!.rerolls, 1);
	assert.deepEqual(
		c.snapshot.state.players[0]!.dice.slice(-2).map((d) => d.face),
		[5, 1]
	);
	assert.equal(await c.play({ action: "reroll", ids: ["0-5"] }), false);
	await c.play({ action: "reroll", ids: ["0-4"] });
	assert.equal(c.snapshot.state.phase, "equipment");
	assert.equal(c.snapshot.state.players[0]!.cards.length, 0);
	await c.play({ action: "ready" });
	await c.play({ action: "beginMovement" });
	assert.equal(c.snapshot.state.players[0]!.position, BONUS_TILE);
	assert.ok(!cell(c.snapshot.state, BONUS_TILE).equipment);
	const card = c.snapshot.state.players[0]!.cards[0]!;
	assert.equal(card.id, "rope");
	assert.equal(card.availableRound, c.snapshot.state.round);
	assert.equal(c.snapshot.state.round, 2);
	assert.ok(c.snapshot.state.log.some((entry) => entry.animation?.kind === "eruption"));
	assert.equal(c.snapshot.state.log.filter((entry) => entry.journey?.moved).length, 3);
	assert.equal(c.snapshot.canContinue, false);
	assert.equal(c.snapshot.completed, true, c.snapshot.error);
});

test("automatic movement cannot save a plan caught by the extra plus normal eruption", async () => {
	const c = await createTutorial(lavaLesson);
	const before = c.snapshot.state;
	assert.equal(before.phase, "equipment");
	assert.equal(before.initOptions.autoMovement, true);
	assert.equal(before.initOptions.autoProgress, true);
	assert.equal(terrain(cell(before, "4,2").terrain).kind, "village", "Keep the village entrance in its normal place");
	assert.ok(before.players.every((p) => !cell(before, p.position).lava));
	assert.ok(!threatened(before).includes(before.players[1]!.position));

	const withoutMarker = structuredClone(before);
	cell(withoutMarker, ERUPTION_TILE).eruption = 0;
	const singleWave = applyMove(withoutMarker, { action: "ready" }, 0);
	assert.equal(singleWave.outcome, null, "The normal wave alone does not catch Mika this round");
	assert.equal(singleWave.log.filter((e) => e.animation?.kind === "eruption").length, 1);

	await c.continue();
	assert.equal(await c.play({ action: "beginMovement" }), false, "The learner cannot choose movement order");
	assert.equal(await c.play({ action: "ready" }), true, c.snapshot.error);
	const after = c.snapshot.state;
	assert.equal(after.phase, "ended");
	assert.equal(after.outcome, "lost");
	assert.equal(cell(after, ERUPTION_TILE).eruption, 0);
	assert.ok(after.players.every((p) => p.resolved));
	assert.deepEqual(
		after.players.map((p) => p.position),
		[ERUPTION_TILE, "3,2", "4,2"]
	);
	const waves = after.log.flatMap((entry) => (entry.animation?.kind === "eruption" ? [entry.animation.cells] : []));
	assert.equal(waves.length, 2);
	assert.ok(!waves[0]!.includes("3,2"), "Mika survives the extra wave");
	assert.ok(waves[1]!.includes("3,2"), "The normal wave then catches Mika");
	const villageRoutes = (seat: number) =>
		Object.values(paths(after, seat)).filter(
			(route) =>
				terrain(cell(after, route.at(-1)!).terrain).kind === "village" && !threatened(after).includes(route.at(-1)!)
		);
	assert.ok(
		villageRoutes(0).some((you) => villageRoutes(2).some((ren) => you.at(-1) !== ren.at(-1))),
		"Both survivors can reach different village tiles before the next eruption; the road is not cut off"
	);
	assert.match(after.log.at(-1)!.text, /Mika was caught by the lava/);
	assert.equal(c.snapshot.canContinue, false);
	assert.equal(c.snapshot.completed, true, c.snapshot.error);
});
