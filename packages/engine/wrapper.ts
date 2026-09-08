import {
	initGame,
	applyMove,
	stripSecret,
	activePlayers,
	dropGamePlayer,
	setPlayerName,
	replay as replayGame,
} from "./src/game.js";
import type { State } from "./src/types.js";
export { stripSecret };
export { moveAI } from "./src/ai.js";
export const hashSeed = true;
// BGS evaluates the saved state. A live update must preserve active seats.
export const isLiveUpdate = (s: State): boolean => s.liveUpdate === true;
export async function init(players: number, expansions: string[], options: Record<string, unknown>, seed: string) {
	if (expansions.length) throw Error("No expansions are implemented.");
	return initGame(players, options, seed);
}
export function move(data: State, input: unknown, player: number) {
	return applyMove(data, input, player);
}
export const ended = (s: State) => s.outcome !== null;
export const currentPlayer = (s: State) => {
	const seats = activePlayers(s).filter((i) => s.phase !== "planning" || !s.players[i]!.ready);
	return seats.length === 1 ? seats[0] : seats.length ? seats : undefined;
};
export const round = (s: State) => s.round;
export const scores = (s: State) =>
	s.players.map((p) => (s.outcome === "won" ? 4 - p.injuries.length + p.cards.length : 0));
export const rankings = (s: State) => s.players.map(() => 1);
export const logLength = (s: State) => s.log.length;
export const logSlice = (s: State, o: { player?: number; start: number; end?: number }) => ({
	log: s.log.slice(o.start, o.end).map((e) => ({ ...e, simple: e.text })),
});
export const replay = (s: State, o?: { to?: number }) => replayGame(s, o?.to);
export function setPlayerMetaData(s: State, seat: number, meta: { name: string }) {
	return setPlayerName(s, seat, meta.name);
}
export const dropPlayer = dropGamePlayer;
