export type Listener<T = unknown> = (payload: T) => void;

export class Emitter {
	private listeners = new Map<string, Set<Listener>>();

	on<T = unknown>(event: string, listener: Listener<T>): () => void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		const wrapped = listener as Listener;
		set.add(wrapped);
		return () => set.delete(wrapped);
	}

	once<T = unknown>(event: string, listener: Listener<T>): () => void {
		const off = this.on<T>(event, (payload) => {
			off();
			listener(payload);
		});
		return off;
	}

	emit<T = unknown>(event: string, payload?: T): void {
		for (const listener of this.listeners.get(event) ?? []) {
			try {
				listener(payload);
			} catch (error) {
				console.error(`[fuji-viewer] listener for "${event}" failed`, error);
			}
		}
	}
}
