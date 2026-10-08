<script lang="ts">
	let { name }: { name: "chat" | "help" | "journal" | "fullscreen" | "exit-fullscreen" | "undo" } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === "chat"}
		<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z" />
		<path d="M7 9h10M7 13h6" />
	{:else if name === "help"}
		<circle cx="12" cy="12" r="9" />
		<path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3v.1" />
	{:else if name === "journal"}
		<path d="M5 3h14v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 3v18m4-13h5m-5 4h5m-5 4h3" />
	{:else if name === "undo"}
		<path d="M9 3.5 4 8.5l5 5" />
		<path d="M4 8.5h10.5a6 6 0 0 1 0 12H10" />
	{:else if name === "exit-fullscreen"}
		<path d="M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5" />
	{:else}
		<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
	{/if}
</svg>
