<script lang="ts">
	import { tick } from "svelte";
	let overview = $state(false);
	let mapScroll: HTMLDivElement;
	import {
		terrain,
		total,
		neighbors,
		cell,
		distance,
		threatened,
		CHARACTER_COLORS,
		requirementLabel,
		type View,
	} from "fuji-engine";
	import PlayerMarker from "./PlayerMarker.svelte";
	import TravelGuide from "./TravelGuide.svelte";
	import RequirementSymbols from "./RequirementSymbols.svelte";
	import { art } from "./assets";
	let {
		state: game,
		avatars = [],
		colorblind = false,
		seat,
		reserved = {},
		selected = "",
		selectedLocations = [],
		selectionReasons,
		reachable = [],
		previewTotals = false,
		previewImpacts = false,
		onclick,
		oninspect,
	}: {
		state: View;
		avatars?: string[];
		colorblind?: boolean;
		seat?: number;
		reserved?: Record<string, string>;
		selected?: string;
		selectedLocations?: string[];
		selectionReasons?: Record<string, string>;
		reachable?: string[];
		previewTotals?: boolean;
		previewImpacts?: boolean;
		onclick: (id: string) => void;
		oninspect: (id: string) => void;
	} = $props();
	const impactPlayers = $derived(
		previewImpacts && seat !== undefined
			? neighbors(game, seat).filter((i) => {
					const p = game.players[i]!;
					return game.phase !== "planning" || p.path.length > 1 || p.ready;
				})
			: []
	);
	const opposite = $derived(game.players.length === 4 && seat !== undefined ? (seat + 2) % 4 : -1);
	const danger = $derived(threatened(game));
	const mapWidth = $derived(116 + Math.max(...game.board.map((c) => c.x)) * 100);
	// Empty rectangles in the seven production layouts, including four-player tiles.
	const layout = $derived(
		(
			{
				1: { guide: [14, 519, 385], counter: [game.players.length === 4 ? 714 : 614, 108] },
				2: { guide: [14, 603, 485], counter: [714, game.players.length === 4 ? 184 : 268] },
				3: { guide: [14, 519, 485], counter: [614, 435] },
				4: { guide: [514, 435, 185], counter: [714, 16] },
				5: { guide: [414, 519, 185], counter: [14, 184] },
				6: { guide: [14, 351, 285], counter: [14, 519] },
				7: { guide: [214, 267, 285], counter: [14, 268] },
			} as Record<number, { guide: number[]; counter: number[] }>
		)[game.scenario ?? 1]!
	);
	const guideX = $derived(layout.guide[0]!);
	const guideY = $derived(layout.guide[1]!);
	const guideWidth = $derived(layout.guide[2]!);
	const guideHeight = $derived(guideWidth < 200 ? 184 : guideWidth < 300 ? 148 : game.difficulty >= 3 ? 106 : 86);
	const mapHeight = $derived(Math.max(100 + Math.max(...game.board.map((c) => c.y)) * 84, guideY + guideHeight + 5));
	const x = (id: string) => 58 + cell(game, id).x * 100;
	const y = (id: string) => 54 + cell(game, id).y * 84;
	const edges = $derived(
		game.board.flatMap((a) =>
			game.board.filter((b) => distance(a, b) === 1 && (b.x > a.x || b.y > a.y)).map((b) => ({ a, b }))
		)
	);
	$effect(() => {
		const position = seat === undefined ? undefined : game.players[seat]?.position;
		const compact = overview;
		if (position)
			void tick().then(() => {
				if (!mapScroll || compact) return;
				const svg = mapScroll.querySelector("svg");
				if (svg) mapScroll.scrollLeft = (x(position) * svg.clientWidth) / mapWidth - mapScroll.clientWidth / 2;
			});
	});
	const ownColor = $derived(seat === undefined ? "#f1d584" : CHARACTER_COLORS[game.players[seat]!.character]);
	// Stable parallel lanes keep shared segments visible, including opposite directions.
	const destinationMarker = (id: string, player: number) => {
		const c = cell(game, id);
		const data = terrain(c.terrain);
		const targets = game.players.flatMap((p, i) =>
			!p.resolved && (p.path.length > 1 || p.ready) && p.path.at(-1) === id ? [i] : []
		);
		const obstacles = [
			...(c.equipment && !c.lava ? [[29, -25, 10]] : []),
			...(c.eruption && !c.lava ? [[-29, -25, 13]] : []),
			...(data.kind === "village" ? [[0, -32, 13]] : []),
			...(data.reroll && !c.lava ? [[-34, c.eruption ? 3 : -22, 9]] : []),
		];
		const candidates = [
			[0, -27],
			[-26, -27],
			[26, -27],
			[48, -3],
			[-48, -3],
			[48, 21],
			[-48, 21],
		];
		const available = candidates.filter(([cx, cy]) =>
			obstacles.every(([ox, oy, radius]) => Math.hypot(cx! - ox!, cy! - oy!) >= radius! + 12)
		);
		const offset = available[targets.indexOf(player)] ?? [48, 21];
		return `translate(${x(id) + offset[0]!},${y(id) + offset[1]!})`;
	};
	const routePoints = (path: string[], player: number) => {
		const offset = (player - (game.players.length - 1) / 2) * 8;
		return path.map((id) => `${x(id) + offset},${y(id) + offset}`).join(" ");
	};
</script>

<div
	data-tutorial="board"
	class="landscape"
	style:--route-color={ownColor}
	style:--landscape-art={`url(${art("land", 21)})`}
>
	<button
		class="map-zoom"
		aria-label={overview ? "Zoom in on the map" : "Show the whole map"}
		title={overview ? "Zoom in on the map" : "Show the whole map"}
		aria-pressed={overview}
		onclick={() => (overview = !overview)}>{overview ? "+" : "−"}</button
	>
	<div class="map-scroll" class:overview bind:this={mapScroll}>
		<svg
			viewBox={`0 0 ${mapWidth} ${mapHeight}`}
			class="map"
			aria-label={`Scenario ${game.scenario ?? 1}, difficulty ${game.difficulty}. Choose a location to inspect or plan a journey.`}
		>
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

			{#each edges as { a, b }}<line
					x1={x(a.id)}
					y1={y(a.id)}
					x2={x(b.id)}
					y2={y(b.id)}
					class="trail"
					class:burnt={a.lava || b.lava}
				/>{/each}
			{#each game.board as c (c.id)}
				{@const peers = impactPlayers.filter((i) => game.players[i]!.path.at(-1) === c.id)}
				{@const data = terrain(c.terrain)}
				<g
					class="location"
					data-tutorial={`tile:${c.id}`}
					class:inactive={game.phase === "setup"}
					class:reserved={!!reserved[c.id]}
					class:reachable={reachable.includes(c.id)}
					class:out-of-range={selectionReasons
						? !!selectionReasons[c.id]
						: reachable.length > 0 && !reachable.includes(c.id) && !c.lava}
					class:selected={selected === c.id || selectedLocations.includes(c.id)}
					class:lava={c.lava}
					class:village={data.kind === "village"}
					role="button"
					aria-disabled={game.phase === "setup"}
					tabindex={game.phase === "setup" ? -1 : 0}
					aria-label={`${data.name}${!selectionReasons && reserved[c.id] ? `, reserved by ${reserved[c.id]}: choose another destination` : ""}${selectionReasons ? `, ${selectionReasons[c.id] || "available to swap, any distance"}` : reachable.length ? (reachable.includes(c.id) ? ", within movement range" : ", outside movement range") : ""}${data.kind === "village" ? ", village destination" : ""}, ${requirementLabel(data.requirement)}${c.lava ? ", covered in lava" : ""}${c.equipment && !c.lava ? ", equipment: finish here to draw a card usable next round" : ""}${c.eruption && !c.lava ? `, crossing or entering triggers ${c.eruption} extra eruption(s)` : ""}${danger.includes(c.id) ? ", threatened by the next eruption" : ""}`}
					onclick={() => onclick(c.id)}
					onkeydown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							onclick(c.id);
						}
					}}
					onmouseenter={() => {
						if (game.phase !== "setup") oninspect(c.id);
					}}
					onfocus={() => {
						if (game.phase !== "setup") oninspect(c.id);
					}}
					onmouseleave={() => oninspect("")}
					onblur={() => oninspect("")}
				>
					<title
						>{data.name}{reserved[c.id]
							? ` · Reserved by ${reserved[c.id]}: choose another destination; you may pass through`
							: ""}{c.lava
							? " · Lava: cannot enter or cross"
							: `${data.reroll ? " · +1 reroll at this destination" : ""}${c.equipment ? " · Equipment: finish here to draw a card usable next round" : ""}${c.eruption ? ` · Entering or crossing triggers ${c.eruption} extra eruption(s)` : ""}${danger.includes(c.id) ? " · Covered by the next eruption" : ""}`}</title
					>
					<rect x={x(c.id) - 47} y={y(c.id) - 38} width="94" height="76" rx="13" class="land-base" />
					<image
						href={art("land", c.lava ? 1 : c.terrain)}
						x={x(c.id) - 49}
						y={y(c.id) - 41}
						width="98"
						height="82"
						preserveAspectRatio="xMidYMid slice"
						mask="url(#land-mask)"
						class="tile-art"
					/>
					{#if c.lava}<path
							d={`M ${x(c.id) - 35} ${y(c.id) + 15} l 20 -12 -5 -14 25 4 18 -16 M ${x(c.id) + 5} ${y(c.id) - 8} l 12 18 -8 15`}
							class="lava-crack"
						/>{/if}
					<rect x={x(c.id) - 47} y={y(c.id) - 38} width="94" height="76" rx="13" class="location-ring" />
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
							x={x(c.id) - 47}
							y={y(c.id) - 38}
							width="94"
							height="76"
							rx="13"
							class="danger-ring"
						/>{/if}
					{#if !c.lava && ["land", "village"].includes(data.kind)}<rect
							x={x(c.id) - 43}
							y={y(c.id) + 16}
							width="86"
							height="18"
							rx="4"
							fill="#112820e6"
						/><RequirementSymbols requirement={data.requirement} x={x(c.id)} y={y(c.id) + 25} {colorblind} />{/if}

					{#if seat !== undefined && peers.length && !c.lava}
						{#each peers as playerIndex, index}
							{@const player = game.players[playerIndex]!}
							{@const value = total(game.players[seat]!, c.terrain)}
							{@const cx = x(c.id) + (index - (peers.length - 1) / 2) * 43}
							<g
								class="dice-preview impact-preview"
								class:provisional={game.phase === "planning" && !player.ready}
								data-location={c.id}
								data-player={playerIndex}
								style:--impact-color={CHARACTER_COLORS[player.character]}
								aria-label={`Your dice total against ${player.name}: ${value}. ${game.phase !== "planning" || player.ready ? "Confirmed" : "Provisional"} destination.`}
							>
								<rect x={cx - 20} y={y(c.id) - 13} width="40" height="26" rx="6" />
								<text x={cx} y={y(c.id) + 6}>{value}</text>
							</g>
						{/each}
					{:else if previewTotals && seat !== undefined && reachable.includes(c.id) && !reserved[c.id] && !c.lava}
						{@const value = total(game.players[seat]!, c.terrain) + game.players[seat]!.bonus}
						<g class="dice-preview" data-location={c.id} aria-label={`Your current dice total: ${value}`}>
							<title>Your current matching dice total, including bonuses. Rerolls may change it.</title>
							<rect x={x(c.id) - 20} y={y(c.id) - 13} width="40" height="26" rx="6" />
							<text x={x(c.id)} y={y(c.id) + 6}>{value}</text>
						</g>
					{/if}
					{#if data.reroll && !c.lava}<text x={x(c.id) - 34} y={y(c.id) + (c.eruption ? 9 : -16)} class="reroll-mark"
							>↻</text
						>{/if}
				</g>
			{/each}
			{#if ["planning", "reroll", "equipment", "movement"].includes(game.phase)}
				{#each game.players as p, i}
					{#if !p.resolved && (p.path.length > 1 || p.ready)}
						{@const destination = p.path.at(-1)!}
						<g
							class="teammate-route"
							class:opposite={i === opposite}
							data-player={i}
							aria-label={`${p.name}: ${terrain(cell(game, destination).terrain).name}${p.ready ? ", ready" : ", planned"}`}
						>
							{#if p.path.length > 1}
								<polyline points={routePoints(p.path, i)} class="route-shadow" />
								<polyline
									points={routePoints(p.path, i)}
									class="shared-route-line"
									class:provisional={game.phase === "planning" && !p.ready}
									stroke={CHARACTER_COLORS[p.character]}
								/>
							{/if}
							<g class="destination-marker" transform={destinationMarker(destination, i)}>
								<PlayerMarker avatar={avatars[i]} number={i + 1} color={CHARACTER_COLORS[p.character]!} radius={10} />
							</g>
						</g>
					{/if}
				{/each}
			{/if}
			{#each game.players as p, i (i)}
				{#if i === seat && p.ready && game.phase === "planning" && p.path.length}
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
				{@const occupants = game.players.map((q, j) => (q.position === p.position ? j : -1)).filter((j) => j >= 0)}
				{@const offset = (occupants.indexOf(i) - (occupants.length - 1) / 2) * 27}
				<g
					class="traveler"
					class:opposite={i === opposite}
					data-player={i}
					role="button"
					tabindex="0"
					aria-label={`${p.name}${i === opposite ? ". Opposite player, not your neighbour. Your dice are not compared with each other." : ""}`}
					onclick={() => onclick(p.position)}
					onkeydown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							onclick(p.position);
						}
					}}
					style:transform={`translate(${x(p.position) + offset}px,${y(p.position)}px)`}
				>
					<title
						>{p.name}{i === opposite
							? ": opposite player, not your neighbour. Your dice are not compared with each other."
							: ""}</title
					>
					<PlayerMarker avatar={avatars[i]} number={i + 1} color={CHARACTER_COLORS[p.character]!} own={i === seat} />
					{#if i === seat}<path d="M-4 -28H4L0 -22Z" fill="#f4d888" />{/if}
				</g>
			{/each}
			<foreignObject x={layout.counter[0]} y={layout.counter[1]} width="88" height="42" class="village-counter">
				<div
					xmlns="http://www.w3.org/1999/xhtml"
					class="legend-end"
					title={`Scenario ${String(game.scenario ?? 1).padStart(2, "0")} · Level ${game.difficulty}. Everyone must reach a house-marked location.`}
					aria-label={`${game.players.filter((p) => terrain(cell(game, p.position).terrain).kind === "village").length} of ${game.players.length} players in the village`}
				>
					<svg
						viewBox="0 0 24 24"
						width="27"
						height="27"
						fill="none"
						stroke="currentColor"
						stroke-width="1.7"
						aria-hidden="true"><path d="m2 11 10-9 10 9M5 9v12h14V9M10 21v-7h4v7" /></svg
					>
					{game.players.filter((p) => terrain(cell(game, p.position).terrain).kind === "village").length}/{game.players
						.length}
				</div>
			</foreignObject>
			<foreignObject x={guideX} y={guideY} width={guideWidth} height={guideHeight} class="map-guides">
				<div xmlns="http://www.w3.org/1999/xhtml">
					<div class="scene-legend">
						<span><i class="legend-line"></i>Route</span><span><i class="legend-danger"></i>Next eruption</span>
					</div>
					<TravelGuide difficulty={game.difficulty} embedded />
				</div>
			</foreignObject>
		</svg>
	</div>
</div>

<style>
	.map-zoom {
		display: none;
	}
	.dice-preview {
		display: block;
		pointer-events: none;
	}
	.dice-preview rect {
		fill: #102d27;
		stroke: #efdb9c;
		stroke-width: 1.5;
	}
	.dice-preview text {
		fill: #fff0bd;
		font-size: 21px;
		font-weight: 700;
		text-anchor: middle;
	}
	.impact-preview rect {
		stroke: var(--impact-color);
		stroke-width: 2;
	}
	.impact-preview text {
		fill: var(--impact-color);
	}
	.impact-preview.provisional rect {
		stroke-dasharray: 4 3;
	}
	@media (max-width: 650px), (pointer: coarse) {
		.dice-preview {
			display: block;
		}
	}

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
	.map {
		width: 100%;
		height: clamp(500px, calc(100vh - 265px), 760px);
		display: block;
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
	.location.reserved:not(.inactive):hover .location-ring {
		stroke: #bac5b170;
		stroke-width: 1;
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
	@keyframes lava-arrive {
		from {
			stroke-width: 10;
			opacity: 0;
		}
		to {
			stroke-width: 2;
			opacity: 1;
		}
	}
	.lava-crack {
		fill: none;
		stroke: #f5ae4a;
		stroke-width: 2;
		stroke-linecap: round;
		animation:
			lava-arrive 0.8s ease-out,
			pulse 4s ease-in-out infinite;
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
	.opposite {
		opacity: 0.65;
	}
	.traveler:hover,
	.traveler:focus-visible {
		opacity: 1;
	}
	.traveler {
		transition: transform 0.65s cubic-bezier(0.22, 0.61, 0.36, 1);
		pointer-events: auto;
		filter: drop-shadow(0 4px 3px #0007);
	}
	.scene-legend {
		flex-wrap: wrap;
		padding: 0 0 10px;
		display: flex;
		gap: 8px 16px;
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
		display: flex;
		align-items: center;
		gap: 7px;
		color: #d7d7a7;
		font-size: 24px;
		font-variant-numeric: tabular-nums;
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
		.map-zoom {
			display: block;
			position: absolute;
			right: 6px;
			top: 6px;
			z-index: 2;
			width: 40px;
			height: 40px;
			border-radius: 6px;
			border: 1px solid #ddc985;
			background: #163b32;
			color: #ffe6a1;
			font-size: 24px;
		}
		.map-scroll.overview .map {
			min-width: 0;
		}
		.map-scroll {
			overflow-x: auto;
		}
		.map {
			min-width: 640px;
			height: auto;
		}
		.scene-legend {
			padding: 0 0 10px;
			gap: 12px;
		}
	}
</style>
