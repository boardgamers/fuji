<script lang="ts">
	import { onDestroy } from "svelte";

	let { won, animating }: { won: boolean; animating: boolean } = $props();
	let visible = $state(false);
	let initialized = false;
	let previousWin = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const petals = Array.from({ length: 36 }, (_, i) => ({
		left: (i * 37 + 4) % 100,
		drift: ((i % 7) - 3) * 24,
		delay: ((i * 13) % 10) / 10,
		duration: 3.7 + (i % 5) * 0.25,
		color: ["#f2bccb", "#e5a2b6", "#f5dfbb"][i % 3],
	}));

	$effect(() => {
		if (animating) return;
		const entering = initialized && won && !previousWin;
		initialized = true;
		previousWin = won;
		if (!won) {
			clearTimeout(timer);
			visible = false;
		}
		if (entering && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			visible = true;
			clearTimeout(timer);
			timer = setTimeout(() => (visible = false), 6000);
		}
	});
	onDestroy(() => clearTimeout(timer));
</script>

{#if visible}
	<div class="victory-petals" aria-hidden="true">
		{#each petals as petal, i}
			<span
				class="petal"
				style:left={`${petal.left}%`}
				style:--drift={`${petal.drift}px`}
				style:--turn={`${i % 2 ? -280 : 320}deg`}
				style:animation-delay={`${petal.delay}s`}
				style:animation-duration={`${petal.duration}s`}
				><i style:background={petal.color} style:transform={`rotate(${i * 47}deg)`}></i></span
			>
		{/each}
	</div>
{/if}

<style>
	.victory-petals {
		position: fixed;
		inset: 0;
		z-index: 45;
		overflow: hidden;
		pointer-events: none;
	}
	.petal {
		position: absolute;
		top: -24px;
		opacity: 0;
		animation: drift-down ease-in forwards;
	}
	.petal i {
		display: block;
		width: 13px;
		height: 9px;
		border-radius: 70% 15% 70% 35%;
		box-shadow: inset -2px -1px 2px #754b4b22;
	}
	@keyframes drift-down {
		0% {
			opacity: 0;
			transform: translate3d(0, 0, 0) rotate(0deg);
		}
		15% {
			opacity: 0.85;
		}
		75% {
			opacity: 0.7;
		}
		100% {
			opacity: 0;
			transform: translate3d(var(--drift), 110vh, 0) rotate(var(--turn));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.victory-petals {
			display: none;
		}
	}
</style>
