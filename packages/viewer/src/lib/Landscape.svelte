<script lang="ts">
	import { terrain, cell, distance, threatened, CHARACTER_COLORS, requirementLabel, type View } from "fuji-engine";
	import RequirementSymbols from "./RequirementSymbols.svelte";
	import { art } from "./assets";
	let {
		state,
		colorblind = false,
		seat,
		reserved = {},
		selected = "",
		reachable = [],
		onclick,
		oninspect,
	}: {
		state: View;
		colorblind?: boolean;
		seat?: number;
		reserved?: Record<string, string>;
		selected?: string;
		reachable?: string[];
		onclick: (id: string) => void;
		oninspect: (id: string) => void;
	} = $props();
	const danger = $derived(threatened(state));
	const x = (id: string) => 58 + cell(state, id).x * 100;
	const y = (id: string) => 54 + cell(state, id).y * 84;
	const edges = $derived(
		state.board.flatMap((a) =>
			state.board.filter((b) => distance(a, b) === 1 && (b.x > a.x || b.y > a.y)).map((b) => ({ a, b }))
		)
	);
	const ownColor = $derived(seat === undefined ? "#f1d584" : CHARACTER_COLORS[state.players[seat]!.character]);
	// Stable parallel lanes keep shared segments visible, including opposite directions.
	const routePoints = (path: string[], player: number) => {
		const offset = (player - (state.players.length - 1) / 2) * 8;
		return path.map((id) => `${x(id) + offset},${y(id) + offset}`).join(" ");
	};
</script>

<div class="landscape" style:--route-color={ownColor} style:--landscape-art={`url(${art("land", 21)})`}>
	<div class="scene-caption">
		<span class="eyebrow">THE FUJI TRAIL</span><span
			>Scenario 01 <span class="dot">·</span> Level {state.difficulty}</span
		>
	</div>
	<div class="map-scroll">
		<svg viewBox="0 0 835 630" class="map" aria-label="Expedition map. Choose a location to inspect or plan a journey.">
			<defs>
				<radialGradient id="feather"
					><stop offset="65%" stop-color="white" /><stop offset="100%" stop-color="black" /></radialGradient
				>
				<mask id="land-mask" maskContentUnits="objectBoundingBox"
					><rect width="1" height="1" fill="url(#feather)" /></mask
				>
				<linearGradient id="lava-gradient" x2="1" y2="1"
					><stop stop-color="#ffcd64" /><stop offset=".45" stop-color="#e45931" /><stop
						offset="1"
						stop-color="#751f21"
					/></linearGradient
				>
				<filter id="glow"><feGaussianBlur stdDeviation="4" /></filter>
			</defs>

			<text x="45" y="607" class="map-note">ORTHOGONAL PATHS · ESCAPE TOGETHER</text>
			{#each edges as { a, b }}<line
					x1={x(a.id)}
					y1={y(a.id)}
					x2={x(b.id)}
					y2={y(b.id)}
					class="trail"
					class:burnt={a.lava || b.lava}
				/>{/each}
			{#each state.board as c (c.id)}
				{@const data = terrain(c.terrain)}
				<g
					class="location"
					class:inactive={state.phase === "setup"}
					class:reachable={reachable.includes(c.id)}
					class:out-of-range={reachable.length > 0 && !reachable.includes(c.id) && !c.lava}
					class:selected={selected === c.id}
					class:lava={c.lava}
					class:village={data.kind === "village"}
					role="button"
					aria-disabled={state.phase === "setup"}
					tabindex={state.phase === "setup" ? -1 : 0}
					aria-label={`${data.name}${reserved[c.id] ? `, reserved by ${reserved[c.id]}: choose another destination` : ""}${reachable.length ? (reachable.includes(c.id) ? ", within movement range" : ", outside movement range") : ""}${data.kind === "village" ? ", village destination" : ""}, ${requirementLabel(data.requirement)}${c.lava ? ", covered in lava" : ""}${c.equipment && !c.lava ? ", equipment: finish here to draw a card usable next round" : ""}${c.eruption && !c.lava ? `, crossing or entering triggers ${c.eruption} extra eruption(s)` : ""}${danger.includes(c.id) ? ", threatened by the next eruption" : ""}`}
					onclick={() => onclick(c.id)}
					onkeydown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onclick(c.id);
						}
					}}
					onmouseenter={() => {
						if (state.phase !== "setup") oninspect(c.id);
					}}
					onfocus={() => {
						if (state.phase !== "setup") oninspect(c.id);
					}}
				>
					<title
						>{data.name}{reserved[c.id]
							? ` · Reserved by ${reserved[c.id]}: choose another destination; you may pass through`
							: ""}{c.lava
							? " · Lava: cannot enter or cross"
							: `${data.reroll ? " · +1 reroll at this destination" : ""}${c.equipment ? " · Equipment: finish here to draw a card usable next round" : ""}${c.eruption ? ` · Entering or crossing triggers ${c.eruption} extra eruption(s)` : ""}${danger.includes(c.id) ? " · Covered by the next eruption" : ""}`}</title
					>
					<rect x={x(c.id) - 44} y={y(c.id) - 35} width="88" height="70" rx="13" class="land-base" />
					<image
						href={art("land", c.lava ? 1 : c.terrain)}
						x={x(c.id) - 47}
						y={y(c.id) - 39}
						width="94"
						height="78"
						preserveAspectRatio="xMidYMid slice"
						mask="url(#land-mask)"
						class="tile-art"
					/>
					{#if c.lava}<path
							d={`M ${x(c.id) - 35} ${y(c.id) + 15} l 20 -12 -5 -14 25 4 18 -16 M ${x(c.id) + 5} ${y(c.id) - 8} l 12 18 -8 15`}
							class="lava-crack"
						/>{/if}
					<rect x={x(c.id) - 44} y={y(c.id) - 35} width="88" height="70" rx="13" class="location-ring" />
					{#if data.kind === "village"}<g
							class="village-marker"
							transform={`translate(${x(c.id)},${y(c.id) - 32})`}
							aria-hidden="true"
						>
							<rect x="-12" y="-10" width="24" height="20" rx="5" fill="#193e36" />
							<path
								d="M-8 0 L0 -7 L8 0 M-6 -1 V7 H6 V-1 M-2 7 V2 H2 V7"
								fill="none"
								stroke="#f2df99"
								stroke-width="1.8"
							/>
						</g>{/if}
					{#if c.equipment && !c.lava}<g transform={`translate(${x(c.id) + 29},${y(c.id) - 25})`}
							><circle r="10" class="equipment-dot" /><path
								d="M-7 -3 0 -6 7 -3 0 0Z M-7 -3V4L0 7 7 4V-3 M0 0V7"
								class="equipment-icon"
							/></g
						>{/if}
					{#if c.eruption && !c.lava}<g
							class="eruption-marker"
							transform={`translate(${x(c.id) - 29},${y(c.id) - 25})`}
						>
							<circle r="13" fill="#241f1b" stroke="#ee9969" stroke-width="1" />
							<path d="M-10 9 -4 -2 H4 L10 9Z" class="eruption-volcano" />
							<path d="M-4 -2 -2 3 0 0 3 5 4 -2 M0 -6V-10 M-5 -6 -8 -9 M5 -6 8 -9" class="eruption-lava" />
						</g>{/if}
					{#if danger.includes(c.id)}<rect
							x={x(c.id) - 44}
							y={y(c.id) - 35}
							width="88"
							height="70"
							rx="13"
							class="danger-ring"
						/>{/if}
					{#if !c.lava && ["land", "village"].includes(data.kind)}<rect
							x={x(c.id) - 40}
							y={y(c.id) + 17}
							width="80"
							height="18"
							rx="4"
							fill="#112820e6"
						/><RequirementSymbols requirement={data.requirement} x={x(c.id)} y={y(c.id) + 26} {colorblind} />{/if}
					{#if reserved[c.id]}<g
							class="reserved-marker"
							aria-hidden="true"
							transform={`translate(${x(c.id)},${y(c.id) - 16})`}
						>
							<rect x="-29" y="-9" width="58" height="18" rx="4" fill="#102b25" stroke="#bac5b1" stroke-width="0.8" />
							<text text-anchor="middle" y="3" fill="#e5e9dd" font-size="9" font-weight="600">Reserved</text>
						</g>{/if}
					{#if data.reroll && !c.lava}<text x={x(c.id) - 34} y={y(c.id) - 16} class="reroll-mark">↻</text>{/if}
				</g>
			{/each}
			{#if ["planning", "reroll", "equipment", "movement"].includes(state.phase)}
				{#each state.players as p, i}
					{#if !p.resolved && (p.path.length > 1 || p.ready)}
						{@const destination = p.path.at(-1)!}
						<g
							class="teammate-route"
							data-player={i}
							aria-label={`${p.name}: ${terrain(cell(state, destination).terrain).name}${p.ready ? ", ready" : ", planned"}`}
						>
							{#if p.path.length > 1}
								<polyline points={routePoints(p.path, i)} class="route-shadow" />
								<polyline
									points={routePoints(p.path, i)}
									class="shared-route-line"
									class:provisional={state.phase === "planning" && !p.ready}
									stroke={CHARACTER_COLORS[p.character]}
								/>
							{/if}
							<g transform={`translate(${x(destination) + 27},${y(destination) - 27 + i * 20})`}>
								<circle r="10" fill="#102b25" stroke={CHARACTER_COLORS[p.character]} stroke-width="2" />
								<text y="4" text-anchor="middle" fill={CHARACTER_COLORS[p.character]} font-size="12" font-weight="700"
									>{i + 1}</text
								>
							</g>
						</g>
					{/if}
				{/each}
			{/if}
			{#each state.players as p, i (i)}
				{#if i === seat && p.ready && state.phase === "planning" && p.path.length}
					<circle
						cx={x(p.path.at(-1)!)}
						cy={y(p.path.at(-1)!)}
						r="25"
						fill="none"
						stroke={CHARACTER_COLORS[p.character]}
						stroke-width="2"
						stroke-dasharray="3 5"
					/>
				{/if}
				{@const occupants = state.players.map((q, j) => (q.position === p.position ? j : -1)).filter((j) => j >= 0)}
				{@const offset = (occupants.indexOf(i) - (occupants.length - 1) / 2) * 27}
				<g class="traveler" style:transform={`translate(${x(p.position) + offset}px,${y(p.position)}px)`}>
					<circle r="19" fill="#091e1b" stroke={CHARACTER_COLORS[p.character]} stroke-width={i === seat ? 3 : 2} />
					<text text-anchor="middle" y="6" fill={CHARACTER_COLORS[p.character]} class="traveler-number">{i + 1}</text>
					{#if i === seat}<path d="M-4 -28H4L0 -22Z" fill="#f4d888" />{/if}
				</g>
			{/each}
		</svg>
	</div>
	<div class="scene-legend">
		<span
			>{#if state.phase === "setup"}Map preview · choose your equipment first{:else}<i class="legend-line"></i>Your
				route{/if}</span
		>{#if reachable.length}<span class="range-legend">Dimmed: out of range</span>{/if}<span
			><i class="legend-danger"></i>Next eruption</span
		><span class="legend-end" title="Everyone must reach any house-marked village location at the same time."
			>{state.players.filter((p) => terrain(cell(state, p.position).terrain).kind === "village").length} / {state
				.players.length} in the village · reach any house-marked location</span
		>
	</div>
</div>

<style>
	.landscape {
		position: relative;
		overflow: hidden;
		background: #142f29;
		isolation: isolate;
		border: 1px solid #c9ddac16;
		border-radius: 4px;
	}
	.landscape:before {
		content: "";
		position: absolute;
		inset: 0;
		background:
			linear-gradient(120deg, #132e2adb, #122c28ea),
			var(--landscape-art) center/cover;
		z-index: -1;
	}
	.scene-caption {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 23px 26px 0;
		font-size: 12px;
		color: #a1b5a4;
	}
	.dot {
		margin: 0 5px;
		color: #cfb873;
	}
	.map {
		width: 100%;
		height: clamp(390px, calc(100vh - 430px), 610px);
		display: block;
	}
	.map-note {
		font: 9px var(--font-ui);
		letter-spacing: 2px;
		fill: #a1b5a44d;
	}
	.trail {
		stroke: #b7bd8450;
		stroke-width: 3;
		stroke-linecap: round;
		stroke-dasharray: 2 7;
	}
	.trail.burnt {
		stroke: #d8734555;
	}
	.land-base {
		fill: #213e2e;
	}
	.tile-art {
		opacity: 0.86;
		transition: opacity 0.2s;
	}
	.village .location-ring {
		stroke: #e5d08d;
		stroke-width: 2;
	}
	.location {
		cursor: pointer;
		outline: none;
	}
	.location-ring {
		fill: none;
		stroke: #dbc47d25;
		stroke-width: 1;
		transition:
			stroke 0.15s,
			stroke-width 0.15s;
	}
	.location:not(.inactive):hover .location-ring,
	.location:not(.inactive):focus-visible .location-ring {
		stroke: #f2d49a;
		stroke-width: 2;
	}
	.location.inactive {
		cursor: default;
	}
	.location.inactive .location-ring {
		stroke: #dbc47d25;
	}
	.location.selected .location-ring {
		stroke: var(--route-color);
		stroke-width: 2.5;
	}
	.location.selected .tile-art {
		opacity: 1;
	}
	.location.out-of-range .tile-art {
		opacity: 0.32;
	}
	.location.out-of-range .land-base {
		fill: #142b25;
	}
	.location.out-of-range .location-ring {
		stroke-opacity: 0.35;
	}
	.location.reachable.selected .location-ring {
		stroke: var(--route-color);
		stroke-width: 3.5;
		stroke-dasharray: none;
	}
	.equipment-dot {
		fill: #dfc176;
		stroke: #192f26;
		stroke-width: 2;
	}
	.equipment-icon {
		fill: none;
		stroke: #29392a;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	.eruption-volcano {
		fill: #bd6543;
		stroke: #ffb77c;
		stroke-width: 1.3;
		stroke-linejoin: round;
	}
	.eruption-lava {
		fill: none;
		stroke: #ffe3a0;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.reroll-mark {
		font:
			22px Georgia,
			serif;
		fill: #e8edbb;
	}
	.danger-ring {
		fill: none;
		stroke: #eb8c5e;
		stroke-width: 2;
		stroke-dasharray: 4 5;
		animation: pulse 3s ease-in-out infinite;
		pointer-events: none;
	}
	.lava .tile-art {
		opacity: 0.65;
	}
	.lava-crack {
		fill: none;
		stroke: #f5ae4a;
		stroke-width: 2;
		stroke-linecap: round;
		animation: pulse 4s ease-in-out infinite;
	}
	.route-shadow {
		fill: none;
		stroke: #293d28;
		stroke-width: 5;
		stroke-linejoin: round;
		pointer-events: none;
	}
	.teammate-route {
		pointer-events: none;
	}
	.shared-route-line {
		fill: none;
		stroke-width: 2.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.shared-route-line.provisional {
		stroke-dasharray: 6 6;
		animation: route-flow 3s linear infinite;
	}
	.traveler {
		transition: transform 0.65s cubic-bezier(0.22, 0.61, 0.36, 1);
		pointer-events: none;
		filter: drop-shadow(0 4px 3px #0007);
	}
	.traveler-number {
		font: 600 17px var(--font-ui);
	}
	.scene-legend {
		padding: 0 25px 20px;
		display: flex;
		gap: 20px;
		color: #a7b9a8;
		font-size: 12px;
		align-items: center;
	}
	.scene-legend span {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.legend-line {
		width: 20px;
		border-top: 2px dashed var(--route-color);
	}
	.legend-danger {
		width: 9px;
		height: 9px;
		border: 1px dashed #eb8c5e;
		border-radius: 2px;
	}
	.legend-end {
		margin-left: auto;
		color: #d7d7a7;
	}
	@keyframes pulse {
		50% {
			opacity: 0.5;
		}
	}
	@keyframes route-flow {
		to {
			stroke-dashoffset: -24;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shared-route-line.provisional,
		.danger-ring,
		.lava-crack {
			animation: none;
		}
		.traveler {
			transition: none;
		}
	}
	@media (max-width: 650px) {
		.map-scroll {
			overflow-x: auto;
		}
		.map {
			min-width: 610px;
			height: auto;
		}
		.scene-caption {
			padding: 16px 16px 0;
		}
		.scene-legend {
			padding: 8px 16px 16px;
			gap: 12px;
		}
		.legend-end {
			display: none !important;
		}
	}
</style>
