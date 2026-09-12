<script lang="ts">
	let {
		difficulty,
		margin,
		aid = false,
		expanded = false,
	}: { difficulty: number; margin?: number; aid?: boolean; expanded?: boolean } = $props();
	const maximum = $derived(difficulty + 2);
	const current = $derived(
		margin === undefined ? undefined : margin <= 0 ? 0 : Math.min(maximum, Math.ceil(margin / 2))
	);
</script>

<details class="stamina-guide" open={expanded}>
	<summary>ⓘ Stamina cost</summary>
	<p>Lead = your total − the highest neighbouring total.</p>
	<table>
		<thead><tr><th>Lead</th><th>Stamina lost</th></tr></thead>
		<tbody>
			{#each Array(maximum + 1) as _, i}
				<tr class:current={current === i && !aid}>
					<td>{i === 0 ? "Tie or lower · stay" : i === maximum ? `${2 * i - 1}+` : `${2 * i - 1}–${2 * i}`}</td>
					<td
						>{maximum - i}{#if current === i && !aid}<span aria-label="Current result"> ←</span>{/if}</td
					>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if aid}<p>First aid: no stamina loss this round.</p>{/if}
</details>

<style>
	.stamina-guide {
		margin: 8px 0 16px;
		font-size: 12px;
	}
	summary {
		cursor: pointer;
		color: #dbc587;
	}
	p {
		font-size: 12px;
		color: #b2c6b8;
		margin: 9px 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	th,
	td {
		padding: 6px 8px;
		text-align: left;
		border-bottom: 1px solid #b6c9ad26;
	}
	th {
		font-weight: 500;
		color: #a9bcae;
	}
	th:last-child,
	td:last-child {
		text-align: right;
	}
	.current {
		background: #d8c47a18;
		color: #f0d794;
	}
</style>
