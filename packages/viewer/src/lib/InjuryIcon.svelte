<script lang="ts">
	import type { Injury } from "fuji-engine";
	let { injury }: { injury: Injury } = $props();
	const labels = {
		arm: "Arm injury: cannot use equipment.",
		eye: "Eye injury: lose normal rerolls, including location bonuses. Survivalist still grants its extra reroll.",
		leg: "Leg injury: permanently lose one die.",
		amnesia: "Amnesia: character skill is unavailable.",
	};
</script>

<span class="injury-icon" role="img" aria-label={labels[injury]} title={labels[injury]}>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if injury === "arm"}<path d="m5 4 3-1 3 8 6-3 3 3-2 7H9l-4-5V4Z M9 12l8 4 M14 10l-3 8" />
		{:else if injury === "eye"}<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M4 21 20 3" /><circle
				cx="12"
				cy="12"
				r="3"
			/>
		{:else if injury === "leg"}<path d="m10 3-1 8 4 5-2 5h8l-3-8-2-2 2-8 M8 8l8 2 M10 13l6-3" />
		{:else}<path
				d="M9 21v-4c-4-1-5-5-4-9a7 7 0 0 1 13-1l3 6h-3v4h-4v4 M10 7a2 2 0 0 1 4 0c0 2-2 2-2 4 M12 14h.01"
			/>{/if}
	</svg>
</span>

<style>
	.injury-icon {
		display: inline-flex;
		align-items: center;
		color: #e5a383;
		cursor: help;
		vertical-align: middle;
	}
	svg {
		width: 22px;
		height: 22px;
	}
</style>
