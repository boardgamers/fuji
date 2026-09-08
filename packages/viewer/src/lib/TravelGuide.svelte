<script lang="ts">
	import PhaseIcon from "./PhaseIcon.svelte";
	let { difficulty, embedded = false }: { difficulty: number; embedded?: boolean } = $props();
	const maximum = $derived(difficulty + 2);
</script>

<div class="travel-guide" class:embedded>
	<div
		class="guide-row"
		aria-label="Rerolls by movement distance"
		title="One reroll rolls any number of dice together. Skill and injury effects can change these allowances."
	>
		<span class="guide-label"><PhaseIcon phase={3} /> Steps → <PhaseIcon phase={1} /></span>
		{#each [{ steps: "0", rolls: 2 }, { steps: "1–2", rolls: 1 }, { steps: "3", rolls: 0 }] as rule}
			<span class="guide-chip" aria-label={`${rule.steps} spaces: ${rule.rolls} rerolls`}
				><span>{rule.steps}</span><span class="arrow">→</span><strong>{rule.rolls}</strong></span
			>
		{/each}
		<span class="bonus" title="A destination marked ↻ grants one extra reroll.">↻ tile: +1</span>
	</div>
	<div
		class="guide-row"
		aria-label="Stamina loss by comparison lead"
		title="Lead is your matching total minus the highest comparison neighbor's total. Tie or lower means you cannot move. First aid prevents stamina loss."
	>
		<span class="guide-label">Lead → <span class="heart" aria-label="Stamina lost">♥</span></span>
		{#each Array(maximum + 1) as _, i}
			<span
				class="guide-chip"
				aria-label={`${i === 0 ? "Tie or lower" : i === maximum ? `${2 * i - 1} or more` : `Lead of ${2 * i - 1} to ${2 * i}`}: lose ${maximum - i} stamina`}
			>
				<span>{i === 0 ? "≤0" : i === maximum ? `${2 * i - 1}+` : `${2 * i - 1}–${2 * i}`}</span><span class="arrow"
					>→</span
				><strong class="heart">{maximum - i ? `−${maximum - i}` : "0"}</strong>
			</span>
		{/each}
	</div>
</div>

<style>
	.travel-guide {
		display: grid;
		gap: 8px;
		padding: 0 25px 20px;
		color: #b5c5b4;
		font-size: 12px;
	}
	.guide-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}
	.guide-label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 126px;
		color: #d9c58e;
	}
	.guide-label :global(svg) {
		width: 17px;
		height: 17px;
	}
	.guide-chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 4px 8px;
		border: 1px solid #c5d5b51c;
		border-radius: 5px;
		font-variant-numeric: tabular-nums;
	}
	strong {
		font-weight: 550;
		color: #e2d39e;
	}
	.arrow {
		color: #819987;
	}
	.heart {
		color: #e6b08b;
	}
	.bonus {
		margin-left: 4px;
		color: #c6c8a0;
	}
	@media (max-width: 650px) {
		.travel-guide {
			padding: 0 16px 16px;
		}
		.guide-label {
			min-width: 100%;
		}
	}
	.embedded {
		padding: 0;
		gap: 6px;
		font-size: 11px;
	}
	.embedded .guide-label {
		min-width: 83px;
		gap: 3px;
	}
	.embedded .guide-chip {
		gap: 4px;
		padding: 3px 5px;
	}
	.embedded .guide-row {
		gap: 4px;
	}
	.embedded .bonus {
		margin-left: 0;
	}
</style>
