<script lang="ts">
	import { EQUIPMENT, terrain, type Event } from "fuji-engine";
	import { art } from "./assets";
	import Die from "./Die.svelte";
	let { entry, colorblind }: { entry: Event; colorblind: boolean } = $props();
</script>

{#if entry.journey}{@const j = entry.journey}
	<details class="journey-log">
		<summary>
			<img class="log-portrait" src={art("character", j.character + 1)} alt="" />
			<strong>{j.name}</strong>
			<span class:failed={j.reason === "comparison" || j.reason === "blocked"}>
				{j.moved ? "→ Moved" : "• Stayed"}
			</span>
			<img class="log-location" src={art("land", j.terrain)} alt="" />
			<span>{terrain(j.terrain).name}</span>
			<span class="log-score" title="Matching total compared with the highest neighbor total"
				>{j.own} {j.own > j.highest ? ">" : j.own === j.highest ? "=" : "<"} {j.highest}</span
			>
			{#if j.loss !== null}<span class="log-loss" title="Stamina lost">♥ −{j.loss}</span>{/if}
			{#if j.reason === "comparison"}<span class="failed">{j.own === j.highest ? "Tie" : "Lower total"}</span>
			{:else if j.reason === "blocked"}<span class="failed">Route blocked</span>
			{:else if j.reason === "planned-stay"}<span>Planned stay</span>{/if}
		</summary>
		<div class="comparison-breakdown">
			{#each j.participants as p}<div class="journal-dice">
					<span>{p.name}</span>
					{#each p.dice as d}<Die die={d} {colorblind} disabled />{:else}<span>No matching dice</span>{/each}
					{#if p.bonus}<span>+{p.bonus}</span>{/if}<strong>= {p.total}</strong>
				</div>{/each}
		</div>
	</details>
{:else if entry.transfer}{@const t = entry.transfer}
	<div class="transfer-log">
		<strong>{t.from}</strong><span aria-label="gave">→</span>
		<img class="log-card" src={art("equipment", EQUIPMENT.findIndex((c) => c.id === t.id) + 1)} alt="" />
		<span>{EQUIPMENT.find((c) => c.id === t.id)!.name}</span><span>→</span><strong>{t.to}</strong>
	</div>
{:else if entry.dice}
	<details class="revealed-log">
		<summary>⚄ {entry.diceLabel ?? entry.text}</summary>
		<div class="journal-dice">
			{#each entry.dice as d}<Die die={d} {colorblind} disabled />{:else}<span>No matching dice</span>{/each}
		</div>
	</details>
{:else}
	<span
		><span class="event-icon" aria-hidden="true"
			>{#if entry.type === "eruption"}♨
			{:else if entry.type === "injury"}✚
			{:else if entry.type === "equipment"}▣
			{:else if entry.type === "end"}◆
			{/if}</span
		>{entry.text}</span
	>
{/if}

<style>
	.event-icon {
		margin-right: 6px;
	}
	summary {
		cursor: pointer;
	}
	.journey-log summary,
	.transfer-log {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 9px;
	}
	.journey-log summary::after {
		content: "⌄";
		color: #a6bba9;
	}
	.journey-log[open] summary::after {
		content: "⌃";
	}
	.log-portrait {
		width: 22px;
		height: 28px;
		object-fit: cover;
	}
	.log-location {
		width: 28px;
		height: 24px;
		object-fit: cover;
		border-radius: 3px;
	}
	.log-card {
		width: 24px;
		height: 33px;
		object-fit: contain;
	}
	strong {
		color: #d4ddc4;
		font-weight: 550;
	}
	.log-score {
		color: #e8d391;
		white-space: nowrap;
	}
	.log-loss {
		color: #e8b18b;
		white-space: nowrap;
	}
	.failed {
		color: #e5a383;
	}
	.comparison-breakdown {
		margin: 12px 0 6px 30px;
		display: grid;
		gap: 8px;
	}
	.comparison-breakdown .journal-dice > span:first-child {
		min-width: 105px;
	}
	.revealed-log .journal-dice {
		margin-top: 8px;
	}
</style>
