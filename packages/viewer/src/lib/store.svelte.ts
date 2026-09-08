import { SoundDesign, type SoundCue } from "./sound";
import type { View, Move } from "fuji-engine";
export class Store {
	state: View | null = $state(null);
	private audio = new SoundDesign();
	sound = $state(true);
	setSound(enabled: boolean) {
		this.sound = enabled;
		this.audio.setEnabled(enabled);
	}
	testSound(cue: SoundCue) {
		void this.audio.preview(cue);
	}
	destroy() {
		this.dispose();
		this.audio.destroy();
	}
	scene: View | null = $state(null);
	journal: View["log"] = $state([]);
	animating = $state(false);
	private received: View | null = null;
	private blocksInput = true;
	private receivedSeat: number | undefined;
	private frames: { scene: View; duration: number; cue?: SoundCue }[] = [];
	private animationTimer: ReturnType<typeof setTimeout> | undefined;
	private playFrame() {
		const frame = this.frames.shift();
		if (!frame) {
			this.scene = this.state;
			this.journal = this.state?.log ?? [];
			this.animating = false;
			this.waiting = false;
			return;
		}
		this.animating = true;
		this.waiting = this.blocksInput;
		this.scene = frame.scene;
		this.journal = frame.scene.log;
		if (frame.cue) this.audio.play(frame.cue);
		this.animationTimer = setTimeout(() => this.playFrame(), frame.duration);
	}
	dispose() {
		clearTimeout(this.animationTimer);
		this.audio.stop();
		this.frames = [];
		this.animating = false;
	}
	skipPresentation() {
		this.dispose();
		this.playFrame();
	}
	seat: number | undefined = $state(undefined);
	error = $state("");
	waiting = $state(false);
	local = $state(false);
	autoTeammates = $state(false);
	setAutoTeammates: (enabled: boolean) => void = () => {};
	colorblind = $state(false);
	savePreference: (name: string, value: boolean) => void = () => {};
	setColorblind(value: boolean) {
		this.colorblind = value;
		this.savePreference("colorblind", value);
	}
	send: (move: Move) => void = () => {};
	selectSeat: (seat: number) => void = () => {};
	restart: (players: number, seed: string, difficulty: number, scenario?: number) => void = () => {};
	teammateStep: () => void = () => {};
	dispatch(move: Move) {
		if (this.animating && this.blocksInput) return;
		this.error = "";
		this.waiting = true;
		try {
			this.send(JSON.parse(JSON.stringify(move)));
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.waiting = false;
		}
	}
	receive(s: View) {
		const previous = this.received;
		const reset =
			!previous ||
			this.receivedSeat !== this.seat ||
			s.revision < previous.revision ||
			s.log.length < previous.log.length ||
			document.hidden;
		this.received = s;
		this.receivedSeat = this.seat;
		this.state = s;
		const localDecision = (view: View) =>
			JSON.stringify([
				view.round,
				view.phase,
				view.players[this.seat ?? -1],
				view.pending?.players.includes(this.seat ?? -1) ? view.pending : null,
			]);
		const unrelated = previous && this.seat !== undefined && localDecision(previous) === localDecision(s);
		// Teammate playback must not interrupt an unchanged local decision.
		if (!this.animating || !unrelated) this.blocksInput = !unrelated;
		this.waiting = this.animating && this.blocksInput;
		if (reset) {
			this.dispose();
			this.scene = s;
			this.journal = s.log;
			this.waiting = false;
			return;
		}
		if (s.revision === previous.revision) {
			if (!this.animating) {
				this.scene = s;
				this.journal = s.log;
				this.waiting = false;
			}
			return;
		}
		const scene = structuredClone(previous);
		const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
		for (const event of s.log.slice(previous.log.length)) {
			scene.log.push(event);
			const action = event.animation;
			const cue = event.sound ?? (event.type === "equipment" ? "gear" : undefined);
			if (action?.kind === "move") {
				for (const position of reducedMotion ? action.path.slice(-1) : action.path.slice(1)) {
					scene.players[action.seat]!.position = position;
					this.frames.push({ scene: structuredClone(scene), duration: 700, cue: "step" });
				}
			} else if (action?.kind === "eruption" && action.cells.length) {
				for (const cell of scene.board) if (action.cells.includes(cell.id)) cell.lava = true;
				this.frames.push({ scene: structuredClone(scene), duration: 1100, cue: "lava" });
			} else if (!event.detail && (event.type !== "phase" || cue)) {
				this.frames.push({
					scene: structuredClone(scene),
					duration: cue === "dice" ? 1500 : 1100,
					cue,
				});
			}
		}
		if (!this.animating) this.playFrame();
	}
}
