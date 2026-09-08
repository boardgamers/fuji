<script lang="ts">
	import { CHARACTER_COLORS, type View } from "fuji-engine";
	import { art } from "./assets";
	let {
		players,
		label,
		value,
		seat,
		excludeSelf = false,
		disabled = false,
		onchange,
	}: {
		players: View["players"];
		label: string;
		value: number;
		seat?: number;
		excludeSelf?: boolean;
		disabled?: boolean;
		onchange: (seat: number) => void;
	} = $props();
</script>

<fieldset class="player-choices" {disabled}>
	<legend>{label}</legend>
	<div class="choices">
		{#each players as p, i}{#if !excludeSelf || i !== seat}
				<button
					type="button"
					aria-pressed={value === i}
					class:selected={value === i}
					style:--player-color={CHARACTER_COLORS[p.character]}
					onclick={() => onchange(i)}
				>
					<img src={art("character", p.character + 1)} alt="" />
					<span
						>{p.name}{#if i === seat}<small>You</small>{/if}</span
					>
					{#if value === i}<i aria-hidden="true">✓</i>{/if}
				</button>
			{/if}{/each}
	</div>
</fieldset>

<style>
	.player-choices {
		border: 0;
		padding: 0;
		margin: 14px 0;
		min-width: 0;
	}
	legend {
		font-size: 12px;
		color: #b7c8bb;
		margin-bottom: 8px;
	}
	.choices {
		display: grid;
		gap: 7px;
	}
	button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 6px 10px;
		text-align: left;
		background: #102b25;
		border: 1px solid #b6c9ad26;
		border-radius: 4px;
		color: #dedfc7;
	}
	button:hover:not(:disabled),
	button:focus-visible {
		border-color: var(--player-color);
	}
	button.selected {
		border-color: var(--player-color);
		box-shadow: inset 3px 0 var(--player-color);
		background: #29483a;
	}
	img {
		width: 28px;
		height: 36px;
		object-fit: cover;
	}
	span {
		flex: 1;
		font-size: 13px;
	}
	small {
		display: block;
		font-size: 10px;
		color: #a9bcae;
	}
	i {
		color: var(--player-color);
		font-style: normal;
	}
</style>
