import type { View, Move } from "fuji-engine";
export class Store {
	state: View | null = $state(null);
	seat: number | undefined = $state(undefined);
	error = $state("");
	waiting = $state(false);
	local = $state(false);
	colorblind = $state(false);
	savePreference: (name: string, value: boolean) => void = () => {};
	setColorblind(value: boolean) {
		this.colorblind = value;
		this.savePreference("colorblind", value);
	}
	send: (move: Move) => void = () => {};
	selectSeat: (seat: number) => void = () => {};
	restart: (players: number, seed: string, difficulty: number) => void = () => {};
	teammateStep: () => void = () => {};
	dispatch(move: Move) {
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
		this.state = s;
		this.waiting = false;
	}
}
