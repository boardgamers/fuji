<script lang="ts">
	let { phase }: { phase: number } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width="23"
	height="23"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if phase === 0}
		<circle cx="5" cy="18" r="2" /><path d="M7 18h8a4 4 0 0 0 0-8H9a3 3 0 0 1 0-6h8M14 1l3 3-3 3" />
	{:else if phase === 1}
		<rect x="7" y="7" width="10" height="10" rx="2" /><path
			d="M9 2a10 10 0 0 1 12 8M21 5v5h-5M15 22A10 10 0 0 1 3 14M3 19v-5h5"
		/><circle cx="10" cy="10" r=".8" fill="currentColor" /><circle cx="14" cy="14" r=".8" fill="currentColor" />
	{:else if phase === 2}
		<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 11H3v8h2M19 11h2v8h-2" /><rect
			x="5"
			y="6"
			width="14"
			height="16"
			rx="4"
		/><rect x="8" y="13" width="8" height="6" rx="1" /><path d="M9 9h6" />
	{:else if phase === 3}
		<path d="M5 14c-3-4-2-8 0-9 3-1 5 3 4 7l-1 3ZM5 17l3 1v3H5ZM16 9c-2-4-1-7 1-8 3-1 5 3 4 7l-1 3ZM16 13l3 1v3h-3Z" />
	{:else}
		<path d="m2 21 6-12h8l6 12ZM8 9l2 5 2-3 3 6 1-8M12 5V1M7 6 4 3M17 6l3-3" />
	{/if}
</svg>
