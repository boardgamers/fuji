<script lang="ts">
	import { face, type Die } from "fuji-engine";
	let {
		die,
		selected = false,
		colorblind = false,
		relevant = false,
		conflicts = [],
		disabled = false,
		onclick = () => {},
	}: {
		die: Die;
		colorblind?: boolean;
		selected?: boolean;
		relevant?: boolean;
		conflicts?: { seat: number; name: string; color: string; location: string }[];
		disabled?: boolean;
		onclick?: () => void;
	} = $props();
	const f = $derived(face(die));
	const conflictHelp = $derived(
		conflicts.map((p) => `Adds ${die.face} to the total ${p.name} must beat at ${p.location}`).join(". ")
	);
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
	title={conflictHelp || undefined}
	aria-label={die.face
		? `${f.color} ${die.face}${die.aside ? ", set aside" : relevant ? `, counts +${die.face}` : ""}${conflictHelp ? `. ${conflictHelp}` : ""}`
		: "Hidden die"}
	aria-pressed={selected}
>
	{#if relevant && die.face && !die.aside}<span
			class="matching-badge"
			aria-hidden="true"
			title={`Counts +${die.face} toward the matching total`}>+{die.face}</span
		>{/if}
	{#if die.face}<span class="pips" aria-hidden="true"
			>{#each Array(9) as _, i}<i class:filled={layouts[die.face]?.includes(i)}></i>{/each}</span
		>{#if colorblind}<span class="die-caption">{f.color}</span>{/if}{:else}<span aria-hidden="true">?</span>{/if}
	{#if conflicts.length && die.face && !die.aside}<span class="conflict-badges" aria-hidden="true">
			{#each conflicts as player}<span style:--player-color={player.color}>{player.seat + 1}</span>{/each}
		</span>{/if}
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
	.matching-badge {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		min-width: 28px;
		padding: 3px 5px;
		border-radius: 5px;
		background: #f4e2a8;
		color: #193c30;
		border: 2px solid #193c30;
		font-size: 12px;
		font-weight: 800;
		line-height: 1;
		box-shadow: 0 2px 4px #0005;
		pointer-events: none;
	}

	.conflict-badges {
		position: absolute;
		bottom: -12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 3px;
		pointer-events: none;
	}
	.conflict-badges > span {
		display: grid;
		place-items: center;
		width: 19px;
		height: 19px;
		border: 1.5px solid var(--player-color);
		border-radius: 50%;
		background: #102c25;
		color: var(--player-color);
		font-size: 11px;
		font-weight: 700;
		box-shadow: 0 2px 4px #0005;
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
