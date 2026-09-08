<script lang="ts">
	import { requirementLabel, type Requirement } from "fuji-engine";
	let {
		requirement,
		x,
		y,
		colorblind = false,
	}: { requirement: Requirement; x: number; y: number; colorblind?: boolean } = $props();
	type Token = { color?: string; value?: number };
	const colors: Record<string, string> = { blue: "#82ccdb", pink: "#e16d9a", yellow: "#f2cd5d" };
	const tokens = $derived.by((): Token[] => {
		const r = requirement;
		const hues = r.colors && r.colors.length < 3 ? r.colors : [undefined];
		const values = r.values ?? (r.parity === "odd" ? [1, 3, 5] : r.parity === "even" ? [2, 4, 6] : [undefined]);
		if (r.combine === "or") return [...hues.map((color) => ({ color })), ...values.map((value) => ({ value }))];
		return hues.flatMap((color) => values.map((value) => ({ color, value })));
	});
	const step = $derived(Math.min(22, 78 / tokens.length));
</script>

<g class="requirement-symbols" transform={`translate(${x},${y})`}>
	<title>{requirementLabel(requirement)}</title>
	{#each tokens as token, i}<g transform={`translate(${(i - (tokens.length - 1) / 2) * step},0)`} aria-hidden="true">
			<rect
				x={-step / 2 + 1}
				y="-7"
				width={step - 2}
				height="14"
				rx="3"
				fill={token.color ? colors[token.color] : "#e5e2cf"}
			/>
			<text y="3.5" text-anchor="middle" fill="#112820" font-size={colorblind && token.color ? 8 : 11} font-weight="700"
				>{colorblind && token.color ? token.color[0]!.toUpperCase() : ""}{token.value ?? "✦"}</text
			>
		</g>{/each}
</g>
