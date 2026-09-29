const files = import.meta.glob(
	["../assets/land-*.webp", "../assets/equipment-*.webp", "../assets/character-0[1-4].webp"],
	{ eager: true, query: "?url&no-inline", import: "default" }
) as Record<string, string>;
export function art(kind: string, id: number): string {
	return files[`../assets/${kind}-${String(id).padStart(2, "0")}.webp`] ?? "";
}
