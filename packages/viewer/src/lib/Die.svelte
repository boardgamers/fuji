<script lang="ts">
	import { face, type Die } from "fuji-engine";
	let {
		die,
		selected = false,
		colorblind = false,
		relevant = false,
		disabled = false,
		onclick = () => {},
	}: {
		die: Die;
		colorblind?: boolean;
		selected?: boolean;
		relevant?: boolean;
		disabled?: boolean;
		onclick?: () => void;
	} = $props();
	const f = $derived(face(die));
	const layouts: Record<number, number[]> = {
		1: [4],
		2: [0, 8],
		3: [0, 4, 8],
		4: [0, 2, 6, 8],
		5: [0, 2, 4, 6, 8],
		6: [0, 2, 3, 5, 6, 8],
	};
</script>

<button
	class="die"
	class:chosen={selected}
	class:relevant
	class:aside={die.aside}
	class:hidden={!die.face}
	style:--die-color={die.face ? { blue: "#82ccdb", pink: "#e16d9a", yellow: "#f2cd5d" }[f.color] : "#27433c"}
	{disabled}
	{onclick}
	aria-label={die.face ? `${f.color} ${die.face}${die.aside ? ", set aside" : ""}` : "Hidden die"}
	aria-pressed={selected}
>
	{#if die.face}<span class="pips" aria-hidden="true"
			>{#each Array(9) as _, i}<i class:filled={layouts[die.face]?.includes(i)}></i>{/each}</span
		>{#if colorblind}<span class="die-caption">{f.color}</span>{/if}{:else}<span aria-hidden="true">?</span>{/if}
</button>

<style>
	.die {
		position: relative;
		width: 54px;
		height: 58px;
		border-radius: 11px;
		background: var(--die-color);
		border: 2px solid #ffffff23;
		color: #162b28;
		box-shadow:
			inset 0 -5px 0 #0002,
			0 3px 10px #0003;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			transform 0.16s,
			border-color 0.16s;
		flex: none;
		padding: 7px 9px 13px;
	}
	.die:hover:not(:disabled) {
		transform: translateY(-3px);
	}
	.die:disabled {
		cursor: default;
		opacity: 1;
	}
	.die.chosen {
		transform: translateY(-7px);
		border-color: #fff7cd;
		outline: 2px solid #fff7cd;
		outline-offset: 3px;
	}
	.die.relevant:not(.chosen) {
		box-shadow:
			inset 0 -5px 0 #0002,
			0 0 0 2px #dcecb96b;
	}
	.die.aside {
		opacity: 0.5;
		transform: scale(0.85);
	}
	.pips {
		display: grid;
		grid-template-columns: repeat(3, 6px);
		grid-template-rows: repeat(3, 6px);
		gap: 4px;
	}
	.pips i {
		border-radius: 50%;
		background: transparent;
	}
	.pips i.filled {
		background: #18372f;
	}
	.die-caption {
		position: absolute;
		bottom: 3px;
		font-size: 8px;
		line-height: 1;
		font-weight: 750;
		letter-spacing: 0.035em;
		text-transform: uppercase;
	}
	.hidden {
		border: 1px solid #ffffff14;
		box-shadow: none;
		color: #b4c6b6;
	}
	.hidden span {
		font-family: Georgia, serif;
		font-size: 22px;
	}
</style>
