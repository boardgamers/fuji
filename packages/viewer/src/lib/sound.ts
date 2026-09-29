import diceRollUrl from "../assets/dice-roll.mp3?url&no-inline";
export type SoundCue = "step" | "lava" | "dice" | "gear";

// Recorded dice and synthesized foley. No background loop or game RNG usage.
export class SoundDesign {
	private context?: AudioContext;
	private master?: GainNode;
	private noise?: AudioBuffer;
	private diceRoll?: AudioBuffer;
	private diceLoading?: Promise<void>;
	private stopVersion = 0;
	private enabled = true;
	private sources = new Set<AudioScheduledSourceNode>();
	constructor() {
		document.addEventListener("pointerdown", this.unlock);
		document.addEventListener("keydown", this.unlock);
	}
	private unlock = () => {
		if (!this.enabled) return;
		try {
			if (!this.context) {
				this.context = new AudioContext();
				this.master = this.context.createGain();
				this.master.gain.value = 0.3;
				this.master.connect(this.context.destination);
				this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
				const samples = this.noise.getChannelData(0);
				let seed = 314159;
				for (let i = 0; i < samples.length; i++) {
					seed ^= seed << 13;
					seed ^= seed >>> 17;
					seed ^= seed << 5;
					samples[i] = (seed >>> 0) / 2147483648 - 1;
				}
			}
			if (!this.diceLoading)
				this.diceLoading = fetch(diceRollUrl)
					.then((response) => response.arrayBuffer())
					.then((data) => this.context!.decodeAudioData(data))
					.then((buffer) => {
						this.diceRoll = buffer;
					})
					.catch(() => {});
			void this.context.resume().catch(() => {});
		} catch {
			/* Autoplay or unavailable audio must never interrupt play. */
		}
	};
	setEnabled(enabled: boolean) {
		this.enabled = enabled;
		if (!enabled) this.stop();
	}
	stop() {
		this.stopVersion++;
		for (const source of this.sources) {
			try {
				source.stop();
			} catch {}
		}
		this.sources.clear();
	}
	destroy() {
		this.stop();
		document.removeEventListener("pointerdown", this.unlock);
		document.removeEventListener("keydown", this.unlock);
		void this.context?.close().catch(() => {});
	}
	async preview(cue: SoundCue) {
		if (!this.enabled) return;
		this.stop();
		const version = this.stopVersion;
		this.unlock();
		try {
			await this.context?.resume();
			if (cue === "dice") await this.diceLoading;
			if (version === this.stopVersion) this.play(cue);
		} catch {
			/* Audio may be blocked by the browser. */
		}
	}
	play(cue: SoundCue) {
		const context = this.context;
		if (!this.enabled || !context || context.state !== "running" || document.hidden) return;
		if (cue === "dice") {
			if (!this.diceRoll) return;
			const source = context.createBufferSource();
			source.buffer = this.diceRoll;
			source.connect(this.master!);
			this.sources.add(source);
			source.onended = () => {
				this.sources.delete(source);
				source.disconnect();
			};
			source.start();
			return;
		}
		const pulse = (
			offset: number,
			duration: number,
			frequency: number,
			volume: number,
			noise = false,
			impact = false
		) => {
			const at = context.currentTime + offset;
			const source = noise ? context.createBufferSource() : context.createOscillator();
			if (source instanceof AudioBufferSourceNode) source.buffer = this.noise!;
			else {
				source.type = "sine";
				source.frequency.setValueAtTime(frequency, at);
				source.frequency.exponentialRampToValueAtTime(frequency * (impact ? 1 : 0.6), at + duration);
			}
			const filter = context.createBiquadFilter();
			filter.type = impact && noise ? "bandpass" : "lowpass";
			filter.Q.value = impact ? 3 : 0.7;
			filter.frequency.value = frequency;
			const envelope = context.createGain();
			envelope.gain.setValueAtTime(0, at);
			envelope.gain.linearRampToValueAtTime(volume, at + Math.min(impact ? 0.001 : 0.035, duration / 4));
			envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
			source.connect(filter).connect(envelope).connect(this.master!);
			this.sources.add(source);
			source.onended = () => {
				this.sources.delete(source);
				source.disconnect();
				filter.disconnect();
				envelope.disconnect();
			};
			source.start(at);
			source.stop(at + duration + 0.01);
		};
		if (cue === "step") {
			pulse(0, 0.12, 110, 0.5);
			pulse(0.01, 0.16, 900, 0.35, true);
		} else if (cue === "lava") {
			pulse(0, 0.85, 48, 0.45);
			pulse(0, 0.9, 450, 0.9, true);
			pulse(0.18, 0.5, 1200, 0.16, true);
		} else {
			pulse(0, 0.09, 680, 0.2);
			pulse(0.025, 0.14, 1400, 0.18, true);
		}
	}
}
