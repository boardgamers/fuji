<script lang="ts">
	import type { EquipmentId } from "fuji-engine";
	let { id }: { id: EquipmentId } = $props();
	const paths: Record<EquipmentId, string> = {
		binoculars: "M3 10V5h5v5m8 0V5h5v5M8 12h8M4 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8m16 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
		flare: "M3 9h15v5H9v7H4v-7H3ZM18 9l3-3m-1 6h3M18 5V2",
		rope: "M8 18c-9-5-4-16 4-15s11 12 3 14S7 8 12 8s5 9 0 13M5 19l-2 3",
		shovel: "M9 2h6v4l-3 3-3-3ZM12 9v7m-5 0h10v3l-5 4-5-4Z",
		torch: "M8 14h8l-2 8h-4ZM8 11c-4-5 4-6 3-10 7 5 9 10 3 11M11 10l2-4",
		knife: "M5 15 16 4l5-1-2 5L8 19ZM5 15l-3 3 4 4 3-3",
		water: "M9 2h6v4l3 3v12H6V9l3-3ZM6 12h12M9 6h6",
		aid: "M8 6V3h8v3M3 7h18v14H3ZM12 10v8m-4-4h8",
		radio: "M6 8V1m0 7h13v14H5V8ZM8 12h8M8 16h2m3 0h3m-8 3h2m3 0h3M10 3l8 3",
		tape: "M12 3a9 9 0 1 0 9 9V3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M21 12v9h-6",
		machete: "M5 17 15 3h6c-1 6-6 12-13 17ZM5 17l-3 3 3 3 3-3",
		lighter: "M6 11h12v11H6ZM6 11V7h7v4m1-5c-2-2 1-3 2-5 3 4 3 6 0 7",
		carabiner: "M8 3c-5 0-6 7-5 12s4 8 8 6l8-6c5-4 2-12-3-12ZM15 4 8 18",
		compass: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M16 7l-3 7-6 3 3-7Z",
		map: "M2 5l7-3 6 3 7-3v17l-7 3-6-3-7 3ZM9 2v17m6-14v17",
	};
</script>

<svg
	viewBox="0 0 24 24"
	width="24"
	height="24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.6"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"><path d={paths[id]} /></svg
>
