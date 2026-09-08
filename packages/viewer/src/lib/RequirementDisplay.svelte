<script lang="ts">
	import { requirementLabel, type Requirement } from "fuji-engine";
	import RequirementSymbols from "./RequirementSymbols.svelte";
	let { requirement, colorblind = false }: { requirement: Requirement; colorblind?: boolean } = $props();
</script>

<svg class="requirement-display" viewBox="0 0 84 20" role="img" aria-label={requirementLabel(requirement)}>
	<RequirementSymbols {requirement} {colorblind} x={42} y={10} />
</svg>

<style>
	.requirement-display {
		display: block;
		width: 150px;
		max-width: 100%;
		height: 36px;
	}
</style>
