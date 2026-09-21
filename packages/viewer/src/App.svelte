<script lang="ts">
	import { equipmentPopover } from "./lib/equipmentPopover";
	import ChatPanel from "./lib/ChatPanel.svelte";
	import { untrack, onMount } from "svelte";
	import {
		DICE,
		terrain,
		cell,
		paths,
		mustStay,
		neighbors,
		rerollAllowance,
		matches,
		face,
		total,
		comparison,
		powerBarChoices,
		threatened,
		SKILLS,
		EQUIPMENT,
		INJURIES,
		EXHAUSTION,
		INJURY_AT,
		CHARACTER_COLORS,
		hasSkill,
		activeDice,
		activePlayers,
		canReopenChoice,
		type EquipmentId,
		type View,
	} from "fuji-engine";
	import type { Store } from "./lib/store.svelte";
	import { art } from "./lib/assets";
	import Landscape from "./lib/Landscape.svelte";
	import Die from "./lib/Die.svelte";
	import InjuryIcon from "./lib/InjuryIcon.svelte";
	import EquipmentIcon from "./lib/EquipmentIcon.svelte";
	import JournalEntry from "./lib/JournalEntry.svelte";
	import PhaseIcon from "./lib/PhaseIcon.svelte";
	import RequirementDisplay from "./lib/RequirementDisplay.svelte";
	import PlayerChoices from "./lib/PlayerChoices.svelte";
	import TravelGuide from "./lib/TravelGuide.svelte";
	import StaminaGuide from "./lib/StaminaGuide.svelte";
	import VictoryPetals from "./lib/VictoryPetals.svelte";
	import UtilityIcon from "./lib/UtilityIcon.svelte";
	let { store }: { store: Store } = $props();
	const s = $derived(store.scene ?? store.state);
	const actingSeats = $derived(
		s
			? activePlayers(s).filter(
					(i) => !(!s.pending && ["planning", "equipment"].includes(s.phase) && s.players[i]!.ready)
				)
			: []
	);
	const seat = $derived(store.seat);
	const me = $derived(seat === undefined ? undefined : s?.players[seat]);
	let inspected = $state("");
	let dangerousRoute = $state("");
	let acceptedLavaRisk = $state("");
	let dice = $state<string[]>([]);
	let tilePicks = $state<string[]>([]);
	let tileHint = $state("");
	let tool = $state<EquipmentId | null>(null);
	let copied = $state<EquipmentId>("torch");
	let target = $state(0);
	let giveTarget = $state(0);
	let turnFace = $state(1);
	let keep = $state<string[]>([]);
	let drop = $state("");
	let help = $state(false);
	let journal = $state(true);
	let socialTab = $state("chat");
	let fullscreen = $state(false);
	onMount(() => {
		const update = () => {
			fullscreen = !!document.fullscreenElement;
		};
		update();
		document.addEventListener("fullscreenchange", update);
		return () => document.removeEventListener("fullscreenchange", update);
	});
	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
			else throw new Error("Fullscreen is not available in this browser.");
		} catch (error) {
			store.error = error instanceof Error ? error.message : "Fullscreen could not be opened.";
		}
	}
	$effect(() => {
		store.chat.setPlayer(seat);
	});
	function openChat() {
		socialTab = "chat";
		store.chat.setOpen(true);
		requestAnimationFrame(() =>
			document.querySelector(".expedition-chat")?.scrollIntoView({ behavior: "smooth", block: "center" })
		);
	}
	const journalEntries = $derived(
		store.journal
			.filter((entry) => !entry.detail)
			.slice()
			.reverse() ?? []
	);
	let debugStatus = $state("");
	async function copyDebug() {
		const snapshot = store.exportDebug();
		try {
			await navigator.clipboard.writeText(snapshot);
			debugStatus = "Copied. Paste it into the conversation.";
		} catch {
			debugStatus = "Clipboard unavailable. Download the debug file instead.";
		}
	}
	function downloadDebug() {
		const snapshot = store.exportDebug();
		const url = URL.createObjectURL(new Blob([snapshot], { type: "application/json" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `fuji-debug-${new Date().toISOString().replaceAll(":", "-")}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		debugStatus = "Downloaded. Attach the JSON file to the conversation.";
	}
	let newGame = $state(false);
	let newPlayers = $state(3);
	let newDifficulty = $state(1);
	let newScenario = $state(1);
	let newSkills = $state("random");
	let newSeed = $state("first-light");
	function openNewGame() {
		const current = store.state;
		if (current) {
			newScenario = current.scenario ?? 1;
			newDifficulty = current.difficulty;
			newPlayers = current.players.length;
		}
		newGame = true;
	}
	const reachable = $derived(s && seat !== undefined ? paths(s, seat) : {});
	const reserved = $derived.by(() => {
		const locations: Record<string, string> = {};
		if (s?.phase === "planning" && seat !== undefined) {
			for (const i of neighbors(s, seat)) {
				const player = s.players[i]!;
				if (player.ready) locations[player.path.at(-1)!] = player.name;
			}
			if (mustStay(s, seat)) delete locations[s.players[seat]!.position];
		}
		return locations;
	});
	const focusId = $derived(inspected || me?.path.at(-1) || s?.board.find((c) => c.terrain > 3)?.id || "");
	const focus = $derived(s && focusId ? cell(s, focusId) : undefined);
	const focusTerrain = $derived(focus ? terrain(focus.terrain) : undefined);
	const currentRoute = $derived(me?.path ?? []);
	const destination = $derived(s && currentRoute.length ? terrain(cell(s, currentRoute.at(-1)!).terrain) : undefined);
	const copyOptions = $derived(
		EQUIPMENT.filter(
			(info) =>
				info.id !== "knife" &&
				(info.phases as readonly number[]).includes(s?.phase === "planning" ? 2 : 4) &&
				s?.players.some((p, i) => i !== seat && p.cards.some((c) => c.id === info.id && c.availableRound <= s.round))
		)
	);
	$effect(() => {
		if (tool === "knife" && !copyOptions.some((c) => c.id === copied) && copyOptions[0]) copied = copyOptions[0].id;
	});
	const actionTool = $derived(tool === "knife" ? (copyOptions.some((c) => c.id === copied) ? copied : null) : tool);
	const shovelDie = $derived(dice.length === 1 ? me?.dice.find((d) => d.id === dice[0]) : undefined);
	const binocularReasons = $derived.by(() => {
		if (actionTool !== "binoculars" || !s) return undefined;
		return Object.fromEntries(
			s.board.map((c) => {
				const reasons: string[] = [];
				if (c.lava) reasons.push("covered by lava");
				else if (terrain(c.terrain).kind !== "land") reasons.push("not a land tile");
				if (s.players.some((p) => p.position === c.id)) reasons.push("a player is here");
				if (s.players.some((p) => p.path.at(-1) === c.id)) reasons.push("a destination marker is here");
				if (c.equipment) reasons.push("an equipment token is here");
				if (c.eruption) reasons.push("an eruption marker is here");
				return [c.id, reasons.length ? `Cannot swap: ${reasons.join("; ")}.` : ""];
			})
		);
	});
	const pendingMe = $derived(s?.pending && seat !== undefined && s.pending.players.includes(seat));
	const revealed = $derived(s?.phase === "movement" || s?.phase === "eruption" || s?.phase === "ended");
	const resolvingSeat = $derived(s?.activeResolution ?? seat);
	const resolvingPlayer = $derived(s && resolvingSeat !== undefined ? s.players[resolvingSeat] : undefined);
	const result = $derived(s && resolvingSeat !== undefined && revealed ? comparison(s, resolvingSeat) : null);
	const diceTerrain = $derived(s?.phase === "planning" ? focusTerrain : destination);
	const rule = $derived(diceTerrain?.requirement);
	const diceConflicts = $derived.by(() => {
		if (!s || !me || seat === undefined || !["planning", "reroll", "equipment"].includes(s.phase)) return {};
		// Only our visible dice and the public destinations of comparison neighbors.
		return Object.fromEntries(
			me.dice.map((d) => [
				d.id,
				d.aside || d.remove || !d.face
					? []
					: neighbors(s, seat).flatMap((i) => {
							const player = s.players[i]!;
							if (s.phase === "planning" && player.path.length <= 1 && !player.ready) return [];
							const destination = terrain(cell(s, player.path.at(-1) ?? player.position).terrain);
							return matches(face(d), destination.requirement)
								? [
										{
											seat: i,
											name: player.name,
											color: CHARACTER_COLORS[player.character]!,
											location: destination.name,
											provisional: s.phase === "planning" && !player.ready,
										},
									]
								: [];
						}),
			])
		);
	});
	const localTotal = $derived(me && diceTerrain ? total(me, diceTerrain.id) : 0);
	const danger = $derived(s ? threatened(s) : []);
	const nextAction = $derived(
		!s
			? ""
			: {
					setup: "Prepare your expedition",
					planning: "Find your way forward",
					reroll: "A moment of silence",
					equipment: "Make the most of your gear",
					movement: "Every step counts",
					eruption: "The mountain is waking",
					ended: s.outcome === "won" ? "Together, you made it." : "The mountain won.",
				}[s.phase]
	);
	let decision = "";
	let decisionScreen = "";
	$effect(() => {
		const context = JSON.stringify([
			seat,
			s?.round,
			s?.phase,
			me?.ready,
			me?.rerolls,
			me?.pendingInjuries,
			me?.dice,
			s?.pending?.players.includes(seat ?? -1) ? s.pending : null,
		]);
		const player = me;
		untrack(() => {
			const screen = `${seat}:${s?.round}:${s?.phase}`;
			if (screen !== decisionScreen) {
				decisionScreen = screen;
				dangerousRoute = "";
				acceptedLavaRisk = "";
			}
			if (context !== decision) {
				decision = context;
				dice = [];
				tilePicks = [];
				tool = null;
				if (player) {
					keep = player.cards.slice(0, SKILLS[player.skill].keep).map((c) => c.id);
					drop = player.dice.at(-1)?.id ?? "";
					target = seat ?? 0;
					giveTarget = seat === 0 ? 1 : 0;
				}
			} else if (tool && !player?.cards.some((c) => c.id === tool && c.availableRound <= (s?.round ?? 0))) {
				tool = null;
				tilePicks = [];
			}
		});
	});

	function pickDie(id: string) {
		dice = dice.includes(id) ? dice.filter((x) => x !== id) : actionTool === "shovel" ? [id] : [...dice, id];
	}
	function chooseLocation(id: string) {
		if (s?.phase === "setup") return;
		inspected = id;
		if (tool && ["binoculars", "rope"].includes(actionTool ?? "")) {
			tileHint = binocularReasons?.[id] ?? "";
			if (tileHint) return;
			tilePicks = tilePicks.includes(id)
				? tilePicks.filter((x) => x !== id)
				: [...tilePicks, id].slice(actionTool === "rope" ? -1 : -2);
			return;
		}
		if (s?.phase !== "planning" || !me || me.ready || store.waiting || s.pending) return;
		const route = reachable[id];
		if (!route) return;
		dangerousRoute = "";
		if (danger.includes(id) && !reserved[id]) {
			dangerousRoute = id;
			return;
		}
		if (!reserved[route.at(-1)!] && route.join(";") !== me.path.join(";"))
			store.dispatch({ action: "plan", path: route });
	}

	function confirmTravel() {
		const id = currentRoute.at(-1) ?? "";
		if (danger.includes(id) && acceptedLavaRisk !== `${s?.round}:${id}`) {
			dangerousRoute = id;
			return;
		}
		store.dispatch({ action: "ready" });
	}
	function acceptDangerousRoute() {
		const path = reachable[dangerousRoute];
		if (!path || reserved[dangerousRoute] || store.waiting) return;
		acceptedLavaRisk = `${s?.round}:${dangerousRoute}`;
		dangerousRoute = "";
		store.dispatch({ action: "plan", path });
	}
	function mobileAction() {
		if (!s || !me) return;
		if (s.pending || me.pendingInjuries || s.phase === "setup") {
			document.querySelector(".journey-actions")?.scrollIntoView({ behavior: "smooth" });
			return;
		}
		if (s.phase === "planning") {
			if (me.ready) store.dispatch({ action: "plan", path: me.path });
			else confirmTravel();
			return;
		}
		if (s.phase === "reroll") {
			document.querySelector(".reroll-actions")?.scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		if (s.phase === "equipment") {
			store.dispatch({ action: me.ready ? "unready" : "ready" });
			return;
		}
		if (s.phase === "movement") {
			if (s.activeResolution === null && !me.resolved) store.dispatch({ action: "beginMovement" });
			else document.querySelector(".journey-actions")?.scrollIntoView({ behavior: "smooth" });
			return;
		}
		if (s.phase === "eruption" && seat === 0) store.dispatch({ action: "erupt" });
	}
	const mobileLabel = $derived(
		!s || !me
			? ""
			: s.pending || me.pendingInjuries
				? "Resolve effect"
				: s.phase === "setup"
					? "Prepare expedition"
					: s.phase === "planning"
						? me.ready
							? "Change route"
							: "Ready to travel"
						: s.phase === "reroll"
							? "Dice actions"
							: s.phase === "equipment"
								? me.ready
									? "Change equipment"
									: "Ready to reveal"
								: s.phase === "movement"
									? "Resolve journey"
									: "Advance lava"
	);
	function confirmTool() {
		if (!tool) return;
		store.dispatch({
			action: "equipment",
			id: tool,
			copy: copied,
			ids: dice,
			tiles: tilePicks,
			target,
			face: turnFace,
		});
	}
	function chooseTool(id: EquipmentId) {
		tileHint = "";
		tool = tool === id ? null : id;
		target = ["map", "lighter"].includes(id) ? (seat === 0 ? 1 : 0) : (seat ?? 0);
		tilePicks = [];
		dice = [];
	}
	function modalFocus(node: HTMLElement) {
		const previous = document.activeElement as HTMLElement | null;
		queueMicrotask(() => node.querySelector<HTMLElement>("button")?.focus());
		function key(e: KeyboardEvent) {
			if (e.key === "Escape") {
				help = false;
				newGame = false;
			}
			if (e.key === "Tab") {
				const all = [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]')];
				const first = all[0],
					last = all.at(-1);
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last?.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first?.focus();
				}
			}
		}
		node.addEventListener("keydown", key);
		return {
			destroy() {
				node.removeEventListener("keydown", key);
				previous?.focus();
			},
		};
	}
	const phaseNumber = $derived(
		!s ? 0 : ["setup", "planning", "reroll", "equipment", "movement", "eruption", "ended"].indexOf(s.phase)
	);
</script>

{#snippet journalPanel(location: string)}
	<section data-tutorial="journal" class="journal inline-journal" aria-label="Expedition journal">
		<header class="journal-header">
			<h2>Expedition journal</h2>
			<button
				class="text-button"
				aria-label={journal ? "Collapse journal" : "Expand journal"}
				aria-expanded={journal}
				aria-controls={`journal-entries-${location}`}
				onclick={() => (journal = !journal)}>{journal ? "−" : "+"}</button
			>
		</header>
		{#if journal}
			<ol id={`journal-entries-${location}`} tabindex="0" aria-label="Journal entries">
				{#each journalEntries as e, i}
					{#if i === 0 || journalEntries[i - 1]!.round !== e.round}
						<li class="journal-divider">
							<h3>{e.round === 0 ? "Preparation" : `Round ${String(e.round).padStart(2, "0")}`}</h3>
						</li>
					{/if}
					<li class:latest={i === 0} class:journal-phase={e.type === "phase"}>
						{#if e.type === "phase"}
							<h4><span aria-hidden="true">◇</span>{e.text}</h4>
						{:else}<div class="journal-entry">
								<JournalEntry entry={e} colorblind={store.colorblind} />
							</div>{/if}
					</li>{/each}
			</ol>{/if}
	</section>
{/snippet}

{#if s}
	<VictoryPetals won={s.outcome === "won"} animating={store.animating} />
	<main class="expedition">
		<header class="game-tools">
			<div class="game-brand" title="Fuji · Wolfgang Warsch · Feuerland Spiele">
				<svg class="fuji-mark" viewBox="0 0 44 36" fill="none" aria-hidden="true"
					><circle cx="33" cy="8" r="5" fill="currentColor" opacity=".45" /><path
						d="m3 32 17-27 21 27H3Z"
						fill="currentColor"
						opacity=".16"
					/><path
						d="m3 32 17-27 21 27M13 16l6 3 5-3 5 2"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
				<div>
					<h1>Fuji<span>.</span></h1>
					<p>
						<span class="designer-credit">Wolfgang Warsch ·{" "}</span>Feuerland<span class="publisher-suffix"
							>{" "}Spiele</span
						>
					</p>
				</div>
			</div>
			<div class="round-status">
				<span class="round-label" title={s.phase === "setup" ? "Preparation" : `Round ${s.round}`}
					><span class="status-full">{s.phase === "setup" ? "Preparation" : `Round ${s.round}`}</span><span
						class="status-short">{s.phase === "setup" ? "Setup" : `R${s.round}`}</span
					></span
				><span class="phase-status"
					>{s.outcome
						? "Journey complete"
						: s.phase === "reroll"
							? "Quiet phase"
							: s.phase === "setup"
								? "Preparation"
								: s.phase}</span
				>
				<span class="difficulty-label" title={`Scenario ${s.scenario ?? 1}`}
					><span class="status-full">Scenario{" "}</span><span class="status-short">S</span>{s.scenario ?? 1}</span
				>
				<button
					type="button"
					class="difficulty-label"
					use:equipmentPopover
					aria-label={`Difficulty level ${s.difficulty}: stamina costs`}
					><span class="status-full">Level{" "}</span><span class="status-short">L</span>{s.difficulty}</button
				>
				<span class="equipment-preview difficulty-preview" popover="auto">
					<strong>Difficulty level {s.difficulty} of 4</strong>
					<StaminaGuide difficulty={s.difficulty} expanded />
				</span>
			</div>
			<nav class="game-utilities" aria-label="Game options">
				{#if store.chatAvailable}<button
						class="utility-button"
						onclick={openChat}
						title="Chat"
						aria-label={store.chatState.unreadIds.length ? `Chat · ${store.chatState.unreadIds.length} unread` : "Chat"}
						><UtilityIcon name="chat" />{#if store.chatState.unreadIds.length}<span class="utility-count"
								>{store.chatState.unreadIds.length}</span
							>{/if}</button
					>{/if}
				<button
					class="utility-button"
					title="Journal"
					aria-label="Journal"
					onclick={() => {
						journal = true;
						socialTab = "journal";
						requestAnimationFrame(() =>
							document
								.querySelector(
									window.innerWidth <= 850 && store.chatAvailable
										? ".mobile-journal .inline-journal"
										: ".inline-journal"
								)
								?.scrollIntoView({ behavior: "smooth", block: "nearest" })
						);
					}}><UtilityIcon name="journal" /></button
				>
				<button
					class="utility-button"
					onclick={() => (help = true)}
					title="Playing guide"
					aria-label="Open playing guide"><UtilityIcon name="help" /></button
				>
				<button
					class="utility-button"
					onclick={toggleFullscreen}
					title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
					aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
					aria-pressed={fullscreen}><UtilityIcon name={fullscreen ? "exit-fullscreen" : "fullscreen"} /></button
				>
				<button
					class="text-button playback-skip"
					class:idle={!store.animating}
					disabled={!store.animating}
					aria-label="Skip to latest"
					title="Skip to latest"
					onclick={() => store.skipPresentation()}>»</button
				>
			</nav>
			{#if store.local}<details class="playtest-menu">
					<summary>Playtest tools</summary>
					<div class="dev-toolbar">
						<span>Local playtest</span><span>Click a player to switch seats.</span>
						<label class="auto-teammates"
							><input
								type="checkbox"
								checked={store.autoTeammates}
								onchange={(e) => store.setAutoTeammates(e.currentTarget.checked)}
							/>Automatically play teammates</label
						>
						<label class="auto-teammates" title="Use character portraits to preview BGS avatar markers.">
							<input
								type="checkbox"
								checked={store.avatars.length > 0}
								onchange={(e) => {
									store.avatars = e.currentTarget.checked
										? s.players.map((p) => art("character", p.character + 1))
										: [];
								}}
							/>Preview avatar markers
						</label>
						<button onclick={() => store.teammateStep()} disabled={!!s.outcome || store.animating}
							>Play next teammate action</button
						>
						<label class="auto-teammates"
							><input
								type="checkbox"
								checked={store.sound}
								onchange={(e) => {
									store.setSound(e.currentTarget.checked);
									localStorage.setItem("fuji-sound", String(e.currentTarget.checked));
								}}
							/>Sound effects</label
						>
						<fieldset class="visible-choices sound-tests">
							<legend>Test sounds</legend>
							<div class="choice-row">
								<button disabled={!store.sound} onclick={() => store.testSound("step")}>Footstep</button>
								<button disabled={!store.sound} onclick={() => store.testSound("dice")}>Dice</button>
								<button disabled={!store.sound} onclick={() => store.testSound("lava")}>Lava</button>
								<button disabled={!store.sound} onclick={() => store.testSound("gear")}>Equipment</button>
							</div>
						</fieldset>
						<fieldset class="visible-choices">
							<legend>Share this playtest</legend>
							<div class="choice-row">
								<button onclick={copyDebug}>Copy debug snapshot</button>
								<button onclick={downloadDebug}>Download debug file</button>
							</div>
							<p class="muted small">Includes the seed, settings, move history and all players’ dice.</p>
							{#if debugStatus}<p class="small" role="status">{debugStatus}</p>{/if}
						</fieldset>
						<button onclick={openNewGame}>New game</button>
						<button
							onclick={() => {
								newSeed = crypto.randomUUID().slice(0, 8);
								store.restart(s.players.length, newSeed, s.difficulty, s.scenario ?? 1);
							}}>New random game</button
						>
					</div>
				</details>{/if}
		</header>
		{#if me && !s.outcome}<div class="mobile-dock">
				<div>
					<span class="eyebrow">{s.phase}</span><strong
						>{s.phase === "planning"
							? `${destination?.name ?? ""} · ${destination ? total(me, destination.id) : 0}`
							: s.phase === "reroll"
								? `${me.rerolls} rerolls remaining`
								: me.name}</strong
					>
				</div>
				<button
					data-tutorial={s.phase === "movement" ? "resolve" : "confirm"}
					onclick={mobileAction}
					disabled={store.waiting ||
						(s.phase === "planning" && !me.ready && !!reserved[currentRoute.at(-1)!]) ||
						(s.phase === "reroll" && me.ready) ||
						(s.phase === "equipment" && me.ready && !canReopenChoice(s, seat!)) ||
						(s.phase === "eruption" && seat !== 0)}>{mobileLabel} →</button
				>
				{#if store.chatAvailable && store.chatState.unreadIds.length}<button class="dock-chat" onclick={openChat}
						>Chat{store.chatState.unreadIds.length ? ` · ${store.chatState.unreadIds.length}` : ""}</button
					>{/if}
			</div>{/if}
		<section class="team" aria-label="Your expedition">
			{#each s.players as p, i}
				<article
					class="teammate"
					class:own={seat === i}
					class:opposite={s.players.length === 4 && seat !== undefined && i === (seat + 2) % 4}
					title={`${s.skillChoices?.includes(i) ? "Choosing skill" : `${SKILLS[p.skill].name}: ${SKILLS[p.skill].description}${p.injuries.includes("amnesia") ? " Currently unavailable due to amnesia." : ""}`}${s.players.length === 4 && seat !== undefined && i === (seat + 2) % 4 ? " Opposite player, not your neighbour. Your dice are not compared with each other." : ""}`}
					class:can-act={actingSeats.includes(i)}
					style:--player-color={CHARACTER_COLORS[p.character]}
					aria-label={`${p.name}${seat === i ? ", you" : ""}${actingSeats.includes(i) ? ", can act now" : ""}. ${EXHAUSTION - p.stamina} stamina remaining${p.skill === "gatherer" ? `, ${p.powerBars} power bars` : ""}${store.local ? ". Switch to this player." : ""}`}
				>
					<img src={art("character", p.character + 1)} alt="" class="portrait" />
					<div class="teammate-info">
						<button
							type="button"
							class="teammate-name"
							onclick={() => (store.local ? store.selectSeat(i) : store.clickPlayer(i))}
							>{p.name}{#if seat === i}<small>YOU</small>{/if}</button
						><span class="role-name" title=""
							><button
								type="button"
								class="role-details"
								use:equipmentPopover
								aria-label={`About ${SKILLS[p.skill].name}`}
							>
								{s.skillChoices?.includes(i) ? "Choosing skill" : SKILLS[p.skill].name}
								<span aria-hidden="true">ⓘ</span>
							</button><span class="equipment-preview role-preview" popover="auto">
								<strong>{s.skillChoices?.includes(i) ? "Choosing skill" : SKILLS[p.skill].name}</strong>
								<p>
									{s.skillChoices?.includes(i) ? "This player is choosing their skill." : SKILLS[p.skill].description}
								</p>
								{#if p.injuries.includes("amnesia")}<p>Currently unavailable due to amnesia.</p>{/if}
							</span>{#each p.injuries as injury}<InjuryIcon {injury} />{/each}{#if p.skill === "gatherer"}<span
									class="public-bars"
									title={`${p.powerBars} power bar${p.powerBars === 1 ? "" : "s"}. Each adds +1 to a player's movement total.`}
									aria-label={`${p.powerBars} power bars`}
								>
									<svg
										viewBox="0 0 26 20"
										width="23"
										height="18"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-linejoin="round"
										aria-hidden="true"
										><path
											d="m2 4 3 1 2-1h12l2 1 3-1v12l-3-1-2 1H7l-2-1-3 1Z M7 4v12M19 4v12 M14 6l-4 5h4l-2 4 5-6h-4Z"
										/></svg
									>
									{p.powerBars}</span
								>{/if}</span
						>
					</div>
					<div class="teammate-status">
						<span title="Remaining stamina. At zero, the whole expedition loses."
							><span class="stamina-heart" aria-hidden="true">♥</span>
							{EXHAUSTION - p.stamina}<small> / {EXHAUSTION}</small></span
						><span class="ready-label" class:active-label={actingSeats.includes(i)}
							>{actingSeats.includes(i)
								? s.pending
									? "Respond"
									: p.pendingInjuries
										? "Choose injury"
										: s.phase === "movement" && s.activeResolution !== null
											? s.activeResolution === i
												? "Resolving"
												: "Can help"
											: "Can act"
								: p.pendingInjuries
									? "Injured"
									: p.ready || (p.setupDone && s.phase === "setup")
										? "Ready ✓"
										: p.resolved && s.phase === "movement"
											? "Moved"
											: s.phase === "setup"
												? "Packing"
												: p.injuries.length
													? `${p.injuries.length} injury`
													: ""}</span
						>
					</div>
					{#if p.cards.length}<span class="teammate-equipment" aria-label="Equipment">
							{#each p.cards as c}{@const info = EQUIPMENT.find((e) => e.id === c.id)!}
								<button
									type="button"
									use:equipmentPopover
									class="equipment-chip"
									class:packed={c.availableRound > s.round}
									aria-label={`${info.name}: ${info.description}`}
								>
									<EquipmentIcon id={c.id} /></button
								>
								<span class="equipment-preview" popover="auto">
									<img src={art("equipment", EQUIPMENT.indexOf(info) + 1)} alt={info.name} />
									<span
										><strong>{info.name}</strong><span>{info.description}</span>
										<span class="equipment-phases"
											>{#each info.phases as phase}<span
													title={phase === 2 ? "Use during planning" : "Use during equipment"}
													><PhaseIcon phase={phase === 2 ? 0 : 2} />{phase === 2 ? "Plan" : "Equip"}</span
												>{/each}</span
										>
										{#if c.availableRound > s.round}<em>Available from round {c.availableRound}</em>{/if}
									</span>
								</span>
							{/each}
						</span>{/if}
					<span class="stamina-track" title="Injuries at 20, 15, 10 and 5 stamina remaining." aria-hidden="true">
						<i style:width={`${(1 - p.stamina / EXHAUSTION) * 100}%`}></i>
						{#each INJURY_AT as threshold}<span
								class="injury-tick"
								class:crossed={p.stamina >= threshold}
								style:left={`${(1 - threshold / EXHAUSTION) * 100}%`}
								title={`Injury at ${EXHAUSTION - threshold} stamina remaining`}><span>◆</span></span
							>{/each}
					</span>
				</article>
			{/each}
		</section>
		<div class="game-layout">
			<div class="world-column">
				<Landscape
					avatars={store.avatars}
					colorblind={store.colorblind}
					state={store.scene ?? s}
					{seat}
					{reserved}
					previewTotals={s.phase === "planning" && !!me && !me.ready && !s.pending && !tool}
					previewImpacts={["planning", "reroll", "equipment"].includes(s.phase) && !!me}
					selectedLocations={tool ? tilePicks : []}
					selectionReasons={binocularReasons}
					selected={s.phase === "setup" ? "" : tool ? (tilePicks.at(-1) ?? "") : (currentRoute.at(-1) ?? "")}
					reachable={binocularReasons
						? Object.keys(binocularReasons).filter((id) => !binocularReasons[id])
						: s.phase === "planning" && !me?.ready
							? Object.keys(reachable)
							: []}
					onclick={chooseLocation}
					oninspect={(id) => {
						if (s.phase !== "setup") inspected = id;
					}}
				/>
				<section class="personal" aria-label="Your dice" data-tutorial="dice">
					<div class="personal-title">
						<div>
							<span class="eyebrow"
								>{seat === undefined ? "SPECTATOR VIEW" : revealed ? "DICE REVEALED" : "BEHIND YOUR SCREEN"}</span
							>
							<h2>{me ? SKILLS[me.skill].name : "The expedition"}</h2>
						</div>
						<span class="privacy-tag"
							>{revealed ? "Visible to everyone" : me?.radio ? "Wireless is active" : "Only you can see these"}</span
						>
					</div>
					{#if me}
						<div class="dice-row">
							{#each me.dice as d (d.id)}<Die
									tutorialTarget={`die:${d.id}`}
									colorblind={store.colorblind}
									die={d}
									selected={dice.includes(d.id)}
									conflicts={diceConflicts[d.id] ?? []}
									relevant={s.phase !== "setup" && !d.aside && !!d.face && !!rule && matches(face(d), rule)}
									disabled={(d.aside && !me.pendingInjuries) ||
										store.waiting ||
										s.phase === "setup" ||
										(s.phase === "reroll" && me.ready)}
									onclick={() => pickDie(d.id)}
								/>{/each}
							{#if diceTerrain && s.phase !== "setup"}<div class="dice-total">
									<strong>{localTotal}</strong><span>Matching dice total<br />{diceTerrain.name}</span>
								</div>{/if}
						</div>
						{#if ["planning", "reroll", "equipment"].includes(s.phase)}<p class="dice-conflict-guide">
								Player numbers mark dice that also count against that teammate’s destination.
								{#if s.phase === "planning"}Dashed markers are provisional; solid markers are confirmed.{/if}
							</p>{/if}
						{#if s.phase === "reroll"}<section class="reroll-actions" aria-label="Dice actions">
								{#if me.ready}<p class="confirmed">✓ Your dice are kept. Waiting for the team.</p>
									<button
										class="revise-choice"
										onclick={() => store.dispatch({ action: "unready" })}
										disabled={store.waiting || !canReopenChoice(s, seat!)}>Change my dice choices</button
									>
								{:else}
									<div class="reroll-choice">
										<strong>{me.rerolls} reroll{me.rerolls === 1 ? "" : "s"} remaining</strong>
										{#if me.rerolls}<p>Select any dice, then reroll them together.</p>
											<button
												class="primary"
												disabled={!dice.length || store.waiting}
												onclick={() => store.dispatch({ action: "reroll", ids: dice })}
												>Reroll {dice.length || "selected"} {dice.length === 1 ? "die" : "dice"} ↻</button
											>
										{:else}<p>
												{rerollAllowance(s, seat!) === 0
													? me.injuries.includes("eye")
														? "Your eye injury prevents normal rerolls."
														: `Your ${me.path.length - 1}-space route grants no rerolls.`
													: "You have used all your rerolls."}
											</p>{/if}
									</div>
									{#if hasSkill(me, "buddy")}<div class="reroll-choice buddy-choice">
											<strong>Buddy · optional</strong>
											{#if me.buddyUsed}<p>Die set aside: visible to everyone, excluded from comparisons this round.</p>
											{:else}<p>
													Set one die aside without spending a reroll. It becomes public and does not count this round.
												</p>
												<button
													class="secondary"
													disabled={dice.length !== 1 || store.waiting}
													onclick={() => store.dispatch({ action: "buddy", ids: dice })}>Set selected die aside</button
												>
												{#if dice.length !== 1}<span class="muted small">Select exactly one die above.</span>{/if}
											{/if}
										</div>{/if}
									<button
										class="primary finish-dice"
										disabled={store.waiting}
										data-tutorial="finish-rerolls"
										onclick={() => store.dispatch({ action: "finishRerolls" })}
										>Done with my dice{hasSkill(me, "gatherer") && me.rerolls
											? ` · gain ${Math.min(me.rerolls, 3 - me.powerBars)} bars`
											: ""}<span aria-hidden="true">→</span></button
									>
								{/if}
							</section>{/if}
						{#if s.phase !== "reroll" || !hasSkill(me, "buddy")}
							<div class="skill-line">
								<span class="skill-symbol">◇</span><span
									>{me.injuries.includes("amnesia")
										? "Your skill is unavailable due to amnesia."
										: SKILLS[me.skill].description}</span
								>{#if me.powerBars}<span class="power-bars"
										>{me.powerBars} power bar{me.powerBars === 1 ? "" : "s"}</span
									>{/if}
							</div>
						{/if}
						{#if me.injuries.length}<div class="injury-list">
								{#each me.injuries as injury}<InjuryIcon {injury} />{/each}
							</div>{/if}
					{/if}
				</section>
				<div class:desktop-journal={store.chatAvailable}>{@render journalPanel("desktop")}</div>
			</div>
			<aside class="journey">
				<div class="social-panel" data-tab={socialTab}>
					{#if store.chatAvailable}<nav class="social-tabs" aria-label="Chat and journal">
							<button
								class:active={socialTab === "chat"}
								onclick={() => {
									socialTab = "chat";
									store.chat.setOpen(true);
								}}>Chat{store.chatState.unreadIds.length ? ` · ${store.chatState.unreadIds.length}` : ""}</button
							>
							<button
								class:active={socialTab === "journal"}
								onclick={() => {
									socialTab = "journal";
									journal = true;
								}}>Journal</button
							>
						</nav>{/if}
					<ChatPanel {store} />
					{#if store.chatAvailable}<div class="mobile-journal">{@render journalPanel("mobile")}</div>{/if}
				</div>
				<div class="journey-actions">
					<h2 class="sr-only">{nextAction}</h2>
					<nav class="phase-track" aria-label="Round phases">
						{#each ["Plan", "Reroll", "Equip", "Move", "Erupt"] as label, i}<span
								class:active={phaseNumber === i + 1}
								class:complete={phaseNumber > i + 1}
								title={label}
								aria-label={label}
								aria-current={phaseNumber === i + 1 ? "step" : undefined}><PhaseIcon phase={i} /></span
							>{/each}
					</nav>
					{#if store.error}<div class="error" role="alert">
							{store.error}<button
								class="text-button"
								onclick={() => {
									store.waiting = false;
									store.error = "";
								}}>Dismiss</button
							>
						</div>{/if}
					{#if s.outcome}
						<div class="outcome" class:won={s.outcome === "won"}>
							<span class="outcome-icon">{s.outcome === "won" ? "✧" : "△"}</span>
							<p>{s.reason}</p>
							<p class="muted">{s.round} rounds · {s.players.length} adventurers</p>
							{#if s.outcome === "won"}<strong
									>{s.players.reduce((n, p) => n + 4 - p.injuries.length + p.cards.length, 0)} expedition points</strong
								>{/if}
						</div>
						{#if store.local}<button class="primary" onclick={openNewGame}>Start a new expedition</button>{/if}
					{:else if !me}<p class="instruction">Follow the expedition. Private dice remain hidden until the reveal.</p>
					{:else if s.skillChoices?.length}
						<p class="instruction">
							{s.skillChoices[0] === seat
								? "Choose your skill."
								: `${s.players[s.skillChoices[0]!]!.name} is choosing a skill.`}
						</p>
						<div class="skill-choices">
							{#each Object.entries(SKILLS) as [id, skill]}
								{@const owner = s.players.find((p, i) => !s.skillChoices!.includes(i) && p.skill === id)}
								<button
									disabled={s.skillChoices[0] !== seat || !!owner || store.waiting}
									onclick={() => store.dispatch({ action: "chooseSkill", skill: id })}
								>
									<strong>{skill.name}</strong><span>{skill.description}</span>
									<small
										>{skill.dice} dice · draw {skill.draw}, keep {skill.keep} equipment{owner
											? ` · ${owner.name}`
											: ""}</small
									>
								</button>
							{/each}
						</div>
					{:else if s.phase === "setup"}
						{#if me.setupDone}<p class="instruction">
								Your bag is packed. Waiting for the rest of the expedition.
							</p>{:else}
							<p class="instruction">
								This is preparation, before round 1.
								{#if me.cards.length > SKILLS[me.skill].keep}
									Choose {SKILLS[me.skill].keep} of your {me.cards.length} equipment cards to keep.
								{/if}
								Routes become available once everyone is ready.
							</p>
						{/if}
						<div class="pack-options">
							{#each me.cards as c}{@const info = EQUIPMENT.find((e) => e.id === c.id)!}<button
									aria-pressed={keep.includes(c.id)}
									disabled={me.setupDone || me.cards.length === SKILLS[me.skill].keep}
									class:selected={keep.includes(c.id)}
									onclick={() => (keep = keep.includes(c.id) ? keep.filter((id) => id !== c.id) : [...keep, c.id])}
									><img
										src={art("equipment", EQUIPMENT.findIndex((x) => x.id === c.id) + 1)}
										alt={EQUIPMENT.find((x) => x.id === c.id)?.name}
									/><span class="pack-copy"
										><strong>{info.name}</strong><small>{info.description}</small><small class="equipment-timing"
											>Use during {info.phases.map((p) => (p === 2 ? "planning" : "equipment")).join(" or ")}.</small
										></span
									><i>{keep.includes(c.id) ? "✓" : "+"}</i></button
								>{/each}
						</div>
						{#if !me.setupDone}
							{#if SKILLS[me.skill].dice === 5}<fieldset class="visible-choices starting-dice">
									<legend>Choose one die to leave behind</legend>
									<p>
										You will keep five dice for the expedition. Each row shows all six faces of a die; the two dice of
										each type are identical.
									</p>
									<div class="starting-dice-options">
										{#each me.dice.filter((d, i, dice) => dice.findIndex((other) => other.type === d.type) === i) as d}
											<button
												type="button"
												aria-pressed={me.dice.find((other) => other.id === drop)?.type === d.type}
												onclick={() => (drop = d.id)}
											>
												<span class="starting-die-label"
													>Leave one of these <span aria-hidden="true"
														>{me.dice.find((other) => other.id === drop)?.type === d.type ? "✓" : ""}</span
													></span
												>
												<span class="starting-die-faces"
													>{#each DICE[d.type]! as color, index}<span
															class="starting-die-face"
															style:--face-color={{ blue: "#82ccdb", pink: "#e16d9a", yellow: "#f2cd5d" }[color]}
															aria-label={`${color} ${index + 1}`}
															>{index + 1}{#if store.colorblind}<small>{color}</small>{/if}</span
														>{/each}</span
												>
											</button>
										{/each}
									</div>
								</fieldset>{/if}
							<p class="packing-count">{keep.length} / {SKILLS[me.skill].keep} cards selected</p>
							<button
								class="primary"
								disabled={keep.length !== SKILLS[me.skill].keep || store.waiting}
								onclick={() => store.dispatch({ action: "setup", keep, drop })}
								>Ready for the journey <span>→</span></button
							>
						{/if}
					{:else if me.pendingInjuries}
						<p class="instruction">Choose an injury. Its effect lasts for the rest of the expedition.</p>
						<div class="injury-options">
							{#each INJURIES.filter((i) => !me.injuries.includes(i)) as injury}<button
									onclick={() => store.dispatch({ action: "injury", injury, die: dice[0] })}
									disabled={injury === "leg" && dice.length !== 1}
									><strong
										><InjuryIcon {injury} />
										{injury === "amnesia" ? "Amnesia" : `${injury[0]!.toUpperCase()}${injury.slice(1)} injury`}</strong
									><span
										>{{
											leg: "Select one of your dice to lose after this round.",
											arm: "You can no longer use equipment.",
											eye: "Lose normal rerolls. Skill and equipment rerolls still work.",
											amnesia: "Lose your character skill.",
										}[injury]}</span
									></button
								>{/each}
						</div>
					{:else if s.pending}
						{#if pendingMe}<p class="instruction">
								{s.pending.kind === "lend"
									? "A teammate asks to borrow a die. Select one to lend, or decline."
									: s.pending.required
										? "Choose exactly one die to reroll."
										: "Select any dice to reroll. You may also stop."}
							</p>
							<button
								class="primary"
								disabled={store.waiting ||
									(s.pending.required && dice.length !== 1) ||
									(s.pending.kind === "lend" && dice.length !== 1)}
								onclick={() => store.dispatch({ action: "respond", ids: dice })}
								>{s.pending.kind === "lend" ? "Lend selected die" : "Reroll selected dice"}</button
							>{#if !s.pending.required}<button class="secondary" onclick={() => store.dispatch({ action: "decline" })}
									>{s.pending.kind === "lend" ? "Decline" : "Finish rerolls"}</button
								>{/if}
						{:else}<p class="instruction">
								Waiting for {s.pending.players.map((i) => s.players[i]!.name).join(", ")} to resolve an equipment effect.
							</p>{/if}
					{:else if s.phase === "planning"}
						<p class="instruction">
							Choose a destination. Share your intentions, but keep numbers and exact dice results private.
						</p>
						{#if dangerousRoute && !me.ready}<div class="warning" role="alert">
								<p>
									Lava will reach {terrain(cell(s, dangerousRoute).terrain).name} at the next eruption. Choose a safer destination.
								</p>
								<button
									class="text-button"
									disabled={store.waiting || !!reserved[dangerousRoute]}
									onclick={acceptDangerousRoute}>Choose this dangerous route</button
								>
							</div>{/if}
						{#if destination}<div class="destination">
								<img src={art("land", destination.id)} alt="" />
								<div>
									<span class="eyebrow">YOUR DESTINATION</span>
									<h3>{destination.name}</h3>
									<RequirementDisplay requirement={destination.requirement} colorblind={store.colorblind} />
								</div>
							</div>
							<div class="journey-stats">
								<div><strong>{currentRoute.length - 1}</strong><span>spaces</span></div>
								<div><strong>{rerollAllowance(s, seat!, currentRoute)}</strong><span>rerolls</span></div>
								<div><strong>{total(me, destination.id)}</strong><span>your total</span></div>
							</div>{/if}
						{#if currentRoute.some((id) => cell(s, id).eruption)}<p class="warning">
								This route crosses an eruption marker. Moving here triggers extra lava.
							</p>{/if}
						{#if danger.includes(currentRoute.at(-1) ?? "")}<p class="warning">
								This destination is threatened by the next eruption.
							</p>{/if}
						{#if reserved[currentRoute.at(-1)!]}<p class="instruction">
								{reserved[currentRoute.at(-1)!]} has reserved this destination. Choose another location.
							</p>{/if}
						{#if !me.ready}<button
								class="primary"
								disabled={store.waiting || !!reserved[currentRoute.at(-1)!]}
								data-tutorial="confirm"
								onclick={confirmTravel}>Ready to travel <span>→</span></button
							>{:else}<p class="confirmed">✓ Your route is set. Waiting for the team.</p>
							<button class="revise-choice" onclick={() => store.dispatch({ action: "plan", path: me.path })}
								>Change my route</button
							>{/if}
					{:else if s.phase === "reroll"}
						<p class="instruction">Reroll in silence. Your dice actions are below the map.</p>
					{:else if s.phase === "equipment"}
						<p class="instruction">
							Discuss equipment with your teammates. Your dice are still private and your destination is locked.
						</p>
						{#if !me.ready}<button
								class="primary"
								data-tutorial="confirm"
								onclick={() => store.dispatch({ action: "ready" })}
								disabled={store.waiting}>Ready to reveal <span>→</span></button
							>{:else}<p class="confirmed">✓ Ready. Waiting for the team.</p>
							<button
								class="revise-choice"
								onclick={() => store.dispatch({ action: "unready" })}
								disabled={store.waiting || !canReopenChoice(s, seat!)}>Change my choice</button
							>{/if}
					{:else if s.phase === "movement"}
						{#if s.players.some((p) => p.pendingInjuries)}<p class="instruction">
								Waiting for {s.players
									.filter((p) => p.pendingInjuries)
									.map((p) => p.name)
									.join(", ")} to choose an injury.
							</p>
						{:else if s.activeResolution === null}<p class="instruction">
								Choose who moves next. A route that triggers extra lava is often best resolved last.
							</p>
							{#if !me.resolved}<button
									data-tutorial="resolve"
									class="primary"
									onclick={() => store.dispatch({ action: "beginMovement" })}>Resolve my journey <span>→</span></button
								>{:else}<p class="confirmed">✓ Your journey is resolved.</p>{/if}
						{:else if resolvingPlayer && result}{@const criterion = terrain(
								cell(s, resolvingPlayer.path.at(-1)!).terrain
							).requirement}
							<div class="comparison">
								<span class="eyebrow">{result.success ? "CAN MOVE" : "MUST STAY"}</span><strong
									>{result.own}<small> vs </small>{Math.max(...result.peers.map((p) => p.total))}</strong
								>
								<p>
									{result.success
										? `Lead of ${result.margin} · lose ${result.loss} stamina`
										: `Tie or lower · lose ${result.loss} stamina`}
								</p>
								<StaminaGuide difficulty={s.difficulty} margin={result.margin} aid={resolvingPlayer.aid} />
								<span class="muted small"
									>Dice matching {terrain(cell(s, resolvingPlayer.path.at(-1)!).terrain).name}</span
								>
								{#each [{ seat: resolvingSeat!, total: result.own }, ...result.peers] as peer}
									{@const counted = (peer.seat === -1 ? s.ghost : s.players[peer.seat]!.dice).filter(
										(d) => !d.aside && matches(face(d), criterion)
									)}
									<div class="comparison-player">
										<div class="comparison-name">
											<span
												>{peer.seat === seat
													? "You"
													: peer.seat === -1
														? "Neutral dice"
														: s.players[peer.seat]!.name}</span
											><strong>{peer.total}</strong>
										</div>
										<div class="comparison-dice">
											{#each counted as d}<Die die={d} colorblind={store.colorblind} disabled />{:else}<span
													>No matching dice</span
												>{/each}
										</div>
										{#if peer.seat === resolvingSeat && resolvingPlayer.bonus}<span>+{resolvingPlayer.bonus} bonus</span
											>{/if}
									</div>
								{/each}
							</div>
							{#if s.pendingHelpers?.includes(seat!)}
								<p class="instruction">
									Help {resolvingPlayer.name}? Each bar adds +1 to their total. Your decision resolves the journey
									automatically.
								</p>
								<div class="powerbar-options">
									{#each powerBarChoices(s, seat!) as count}<button
											class="secondary"
											disabled={store.waiting}
											onclick={() => store.dispatch({ action: "help", count })}
											>Use {count} bar{count > 1 ? "s" : ""} · total {result.own + count}</button
										>{/each}
								</div>
								<button
									class="primary"
									disabled={store.waiting}
									onclick={() => store.dispatch({ action: "help", count: 0 })}>Don't use bars</button
								>
							{:else if s.pendingHelpers?.length}<p class="instruction">
									Waiting for {s.pendingHelpers.map((i) => s.players[i]!.name).join(", ")} to decide whether to use power
									bars.
								</p>{/if}
						{/if}
					{:else if s.phase === "eruption"}
						<p class="instruction">
							Journeys resolved. Dice comparisons are in the journal. The lava will spread one step to every adjacent
							location.
						</p>
						<div class="eruption-count"><strong>{danger.length}</strong><span>locations threatened</span></div>
						<button
							data-tutorial="erupt"
							class="primary ember"
							disabled={seat !== 0}
							onclick={() => store.dispatch({ action: "erupt" })}
							>{seat === 0 ? "Let the lava advance" : "Waiting for the expedition leader"} <span>→</span></button
						>
					{/if}
					{#if me && s.phase !== "setup" && !s.outcome}
						<section class="equipment-section" data-tutorial="equipment">
							<div class="section-title">
								<h3>Your equipment</h3>
								<span>{me.cards.length}</span>
							</div>
							{#if !me.cards.length}<p class="muted small">Find equipment along the trail.</p>{/if}
							<div class="equipment-list">
								{#each me.cards as c}{@const info = EQUIPMENT.find((e) => e.id === c.id)!}{@const available =
										c.availableRound <= s.round &&
										!me.injuries.includes("arm") &&
										(info.phases as readonly number[]).includes(
											s.phase === "planning" ? 2 : s.phase === "equipment" ? 4 : -1
										) &&
										!s.pending &&
										(c.id !== "knife" || copyOptions.length > 0)}
									<button
										data-tutorial={`equipment:${c.id}`}
										class:usable={available}
										class:open={tool === c.id}
										onclick={() => chooseTool(c.id)}
										aria-expanded={tool === c.id}
										><img src={art("equipment", EQUIPMENT.indexOf(info) + 1)} alt="" /><span
											><strong>{info.name}</strong><span class="equipment-description">{info.description}</span><small
												>{c.availableRound > s.round
													? "Available next round"
													: c.id === "knife" && !copyOptions.length
														? "No equipment to copy this phase"
														: c.used
															? "One use left"
															: available
																? "Available now"
																: `Use during ${info.phases.map((p) => (p === 2 ? "planning" : "equipment")).join(" or ")}`}</small
											></span
										><span class="equipment-plus">{tool === c.id ? "−" : "+"}</span></button
									>
								{/each}
							</div>
							{#if tool && me.cards.some((c) => c.id === tool)}{@const c = me.cards.find(
									(c) => c.id === tool
								)!}{@const info = EQUIPMENT.find((e) => e.id === tool)!}
								<div class="tool-form">
									{#if tool !== "knife"}<p>{info.description}</p>{/if}
									{#if tool === "knife"}<fieldset class="visible-choices equipment-copy">
											<legend>Copy equipment</legend>
											{#each copyOptions as option}<button
													class="copy-option"
													aria-pressed={copied === option.id}
													onclick={() => {
														copied = option.id;
														dice = [];
														tilePicks = [];
													}}
												>
													<EquipmentIcon id={option.id} /><span
														><strong>{option.name}</strong>
														<small
															>{s.players
																.filter(
																	(p, i) =>
																		i !== seat && p.cards.some((c) => c.id === option.id && c.availableRound <= s.round)
																)
																.map((p) => p.name)
																.join(", ")}</small
														>
														<span>{option.description}</span></span
													>
												</button>{:else}<p>No equipment can be copied in this phase.</p>{/each}
										</fieldset>{/if}
									{#if ["water", "lighter", "map"].includes(actionTool ?? "")}
										<PlayerChoices
											players={s.players}
											{seat}
											value={target}
											disabled={store.waiting}
											label={actionTool === "map"
												? "Lend a die to"
												: actionTool === "lighter"
													? "Borrow a die from"
													: "Reroll dice for"}
											excludeSelf={actionTool === "map" || actionTool === "lighter"}
											onchange={(i) => (target = i)}
										/>
									{/if}
									{#if ["shovel", "torch", "tape", "machete", "compass", "map"].includes(actionTool ?? "")}<p
											class="muted small"
										>
											Select {actionTool === "shovel"
												? "one die"
												: actionTool === "machete"
													? "one or two dice"
													: actionTool === "torch"
														? "one or more dice to reroll"
														: "the dice"} below the map. {dice.length} selected.
										</p>{/if}
									{#if actionTool === "shovel" && shovelDie}<fieldset class="visible-choices">
											<legend>New value</legend>
											<div class="choice-row">
												{#each [1, 2, 3, 4, 5, 6] as n}<Die
														die={{ ...shovelDie, face: n }}
														selected={turnFace === n}
														colorblind={store.colorblind}
														onclick={() => (turnFace = n)}
													/>{/each}
											</div>
										</fieldset>{/if}
									{#if ["binoculars", "rope"].includes(actionTool ?? "")}<p class="muted small">
											{#if actionTool === "binoculars"}Choose two empty land tiles anywhere on the map. No range limit.
												No players, destination markers, equipment or eruption tokens; no village or lava tiles.
											{:else}Choose one adjacent land location on the map.{/if}
											<span
												>{tilePicks.length} selected{tilePicks.length
													? `: ${tilePicks.map((id) => terrain(cell(s, id).terrain).name).join(" + ")}`
													: ""}.</span
											>
											{#if actionTool === "binoculars" && tileHint}<span role="status">{tileHint}</span>{/if}
										</p>{/if}
									<button
										class="secondary"
										disabled={store.waiting ||
											c.availableRound > s.round ||
											(tool === "knife" && !copyOptions.some((option) => option.id === copied)) ||
											me.injuries.includes("arm") ||
											!(info.phases as readonly number[]).includes(
												s.phase === "planning" ? 2 : s.phase === "equipment" ? 4 : -1
											) ||
											!!s.pending ||
											(actionTool === "machete" && (dice.length < 1 || dice.length > 2)) ||
											(actionTool === "torch" && dice.length === 0) ||
											(actionTool === "shovel" && dice.length !== 1) ||
											(actionTool === "binoculars" &&
												(tilePicks.length !== 2 || tilePicks.some((id) => binocularReasons?.[id]))) ||
											(actionTool === "rope" && tilePicks.length !== 1) ||
											(actionTool === "map" && (dice.length !== 1 || target === seat))}
										onclick={confirmTool}>Use {info.name}</button
									>
									{#if hasSkill(me, "manager")}<details class="equipment-transfer">
											<summary>Give this card…</summary>
											<p class="muted small">
												Transfer the {info.name} card to a teammate using your Equipment Manager ability.
											</p>
											<PlayerChoices
												players={s.players}
												{seat}
												value={giveTarget}
												label="Give card to"
												excludeSelf
												disabled={store.waiting}
												onchange={(i) => (giveTarget = i)}
											/>
											<button
												class="secondary"
												disabled={store.waiting || !!s.pending || !["planning", "equipment"].includes(s.phase)}
												onclick={() => store.dispatch({ action: "give", id: tool, target: giveTarget })}
												>Give {info.name} card</button
											>
										</details>{/if}
								</div>
							{/if}
						</section>
					{/if}
					{#if focusTerrain && s.phase !== "setup"}<div class="location-detail">
							<span class="eyebrow">INSPECTING THE TRAIL</span><strong>{focusTerrain.name}</strong>
							<img
								class="inspected-art"
								src={art("land", focusTerrain.id)}
								alt={focusTerrain.name}
							/><RequirementDisplay requirement={focusTerrain.requirement} colorblind={store.colorblind} />
							{#if reserved[focusId]}<span
									>Reserved by {reserved[focusId]}. Choose another destination; you may still pass through.</span
								>{/if}
							{#if focus?.lava}<span>Lava: cannot enter or cross.</span>
							{:else}
								{#if focusTerrain.reroll}<span>↻ +1 reroll when chosen as your destination.</span>{/if}
								{#if focus?.equipment}<span>Equipment: finish your move here to draw a card, usable next round.</span
									>{/if}
								{#if focus?.eruption}<span
										>Eruption: entering or crossing triggers {focus.eruption} extra eruption{focus.eruption === 1
											? ""
											: "s"}. One-time trigger.</span
									>{/if}
								{#if focus && threatened(s).includes(focus.id)}<span>The next eruption will cover this location.</span
									>{/if}
								{#if focusTerrain.kind === "village"}<span
										>Village: any house-marked location counts toward the team’s escape.</span
									>{/if}
							{/if}
						</div>{/if}
				</div>
			</aside>
		</div>
		{#if revealed || s.players.some((p, i) => i !== seat && p.dice.some((d) => d.face > 0))}<section
				class="revealed-team"
				aria-label="Revealed dice"
			>
				{#each s.players as p, i}{#if i !== seat && (revealed || p.dice.some((d) => d.face > 0))}<div>
							<span class="eyebrow">{p.name}</span>
							<div class="mini-dice">
								{#each p.dice as d}<Die
										colorblind={store.colorblind}
										die={d}
										disabled
										relevant={s.phase !== "setup" && !d.aside && !!d.face && !!rule && matches(face(d), rule)}
									/>{/each}
							</div>
						</div>{/if}{/each}
			</section>{/if}
		{#if s.ghost.length}<details class="neutral-dice">
				<summary>Neutral dice · two-player variant A</summary>
				<div class="mini-dice">
					{#each s.ghost as d}<Die colorblind={store.colorblind} die={d} disabled />{/each}
				</div>
			</details>{/if}
	</main>
{:else}<div class="waiting">
		<h1>FUJI</h1>
		<p>Waiting for the expedition…</p>
	</div>{/if}
{#if help}<div class="modal-backdrop" role="presentation">
		<div class="modal" use:modalFocus role="dialog" aria-modal="true" aria-labelledby="help-title" tabindex="-1">
			<button class="close" onclick={() => (help = false)} aria-label="Close guide">×</button><span class="eyebrow"
				>THE ESSENTIALS</span
			>
			<h2 id="help-title">Escape together.</h2>
			<label class="accessibility-option"
				><input
					type="checkbox"
					checked={store.colorblind}
					onchange={(event) => store.setColorblind(event.currentTarget.checked)}
				/>Show color labels (colorblind support)</label
			>
			<p class="game-credits">FUJI · Wolfgang Warsch<br />Illustrations by Weberson Santiago · Feuerland Spiele</p>
			<p>
				Everyone must reach the village. Stamina is your remaining endurance: you start at 25/25, suffer injuries at 20,
				15, 10 and 5 remaining, and lose at zero. If anyone is caught by lava or loses all stamina, the whole expedition
				loses.
			</p>
			<p>
				Add all dice matching any symbol, counting each die once. ✦ means any value; ivory dice mean any color. Houses
				mark village destinations.
			</p>
			<ol class="guide">
				<li>
					<strong>Plan a route.</strong> Move up to three adjacent locations. Longer journeys leave fewer rerolls. Your two
					seated neighbors must choose different destinations from yours.
				</li>
				<li>
					<strong>Talk, without numbers.</strong> Share intentions and vague impressions. Never reveal exact dice values,
					counts or averages. During rerolls, stay silent.
				</li>
				<li>
					<strong>Use your equipment.</strong> Its phase is shown beside each item. Dice remain private until everyone is
					ready to reveal.
				</li>
				<li>
					<strong>Compare on your destination.</strong> Add matching dice. Your total must beat both neighbors. A tie fails.
					A smaller lead costs more stamina. Movement order is automatic; you still choose power bars and injuries.
				</li>
				<li>
					<strong>Watch the lava.</strong> It advances one step each round. Crossing an eruption marker triggers extra lava
					immediately.
				</li>
			</ol>
			{#if s}<StaminaGuide difficulty={s.difficulty} />{/if}
			<button class="primary" onclick={() => (help = false)}>Back to the expedition</button>
		</div>
	</div>{/if}
{#if newGame}<div class="modal-backdrop" role="presentation">
		<div class="modal" use:modalFocus role="dialog" aria-modal="true" aria-labelledby="new-title" tabindex="-1">
			<button class="close" onclick={() => (newGame = false)} aria-label="Close">×</button><span class="eyebrow"
				>A NEW BEGINNING</span
			>
			<h2 id="new-title">Gather your expedition.</h2>
			<p>This replaces the current local playtest.</p>
			<fieldset class="visible-choices">
				<legend>Adventurers</legend>
				<div class="choice-row">
					{#each [2, 3, 4] as n}<button aria-pressed={newPlayers === n} onclick={() => (newPlayers = n)}
							>{n} players</button
						>{/each}
				</div>
				{#if newPlayers === 2}<p class="muted small">Includes neutral dice.</p>{/if}
			</fieldset>
			<fieldset class="visible-choices">
				<legend>Scenario</legend>
				<div class="choice-row">
					{#each [1, 2, 3, 4, 5, 6, 7] as n}<button aria-pressed={newScenario === n} onclick={() => (newScenario = n)}
							>{n}</button
						>{/each}
				</div>
				<p class="muted small">
					Seven official map layouts. The seed shuffles terrain and equipment within the chosen layout.
				</p>
			</fieldset>
			<fieldset class="visible-choices">
				<legend>Skills</legend>
				<div class="choice-row">
					{#each [["random", "Random"], ["choose", "Choose skills"]] as [value, label]}<button
							aria-pressed={newSkills === value}
							onclick={() => (newSkills = value!)}>{label}</button
						>{/each}
				</div>
			</fieldset>
			<fieldset class="visible-choices">
				<legend>Difficulty</legend>
				<div class="choice-row">
					{#each [1, 2, 3, 4] as n}<button aria-pressed={newDifficulty === n} onclick={() => (newDifficulty = n)}
							>Level {n}</button
						>{/each}
				</div>
				<p class="muted small">Higher levels increase stamina loss. Routes, rerolls and lava speed stay the same.</p>
				<TravelGuide difficulty={newDifficulty} />
			</fieldset>
			<label class="field">Expedition seed<input bind:value={newSeed} /></label><button
				class="text-button"
				onclick={() => (newSeed = crypto.randomUUID().slice(0, 8))}>Randomize seed ↻</button
			><button
				class="primary"
				onclick={() => {
					store.restart(newPlayers, newSeed, newDifficulty, newScenario, newSkills);
					newGame = false;
					inspected = "";
				}}>Begin expedition <span>→</span></button
			>
		</div>
	</div>{/if}
