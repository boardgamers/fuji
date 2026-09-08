<script lang="ts">
	let {
		avatar,
		number,
		color,
		radius = 19,
		own = false,
	}: { avatar?: string; number: number; color: string; radius?: number; own?: boolean } = $props();
	const clip = $props.id();
	let failed = $state<string>();
</script>

<circle r={radius} fill="#091e1b" stroke={color} stroke-width={own ? 3 : 2} />
{#if avatar && failed !== avatar}
	<defs><clipPath id={clip}><circle r={radius - 2} /></clipPath></defs>
	<image
		class="player-avatar"
		href={avatar}
		x={2 - radius}
		y={2 - radius}
		width={(radius - 2) * 2}
		height={(radius - 2) * 2}
		preserveAspectRatio="xMidYMid slice"
		clip-path={`url(#${clip})`}
		onerror={() => (failed = avatar)}
	/>
{:else}
	<text text-anchor="middle" y={radius > 10 ? 6 : 4} fill={color} font-size={radius > 10 ? 17 : 12} font-weight="600"
		>{number}</text
	>
{/if}
