// Mention parsing for chat (@username): rendering + autocomplete query state.
//
// Syntax: `@name` for plain-word usernames ([A-Za-z0-9_.-]+), and `@"name with
// spaces"` when the name isn't a plain word (the autocomplete always inserts the
// right form). Usernames forbid "@" by schema (packages/models user.ts), so "@"
// is an unambiguous trigger. The quote form never spans a line break.
//
// Rendering is roster-based: segments resolve against the room's known users, so
// an "@foo" that matches nobody stays plain text (no dead profile link). The
// roster is assembled per room by ChatRoom (game players + chat authors).

export type MentionCandidate = {
	/** User id — the rendered link routes to the profile. */
	id: string;
	/** The username exactly as stored (mention text matches this). */
	name: string;
};

export type MentionSegment = { kind: "text"; text: string } | { kind: "mention"; name: string; id: string };

// Plain-word usernames: letters, digits, underscore, dot, hyphen. Everything
// else (spaces, unicode, …) needs the quoted form.
const PLAIN_NAME = /^[A-Za-z0-9_.-]+$/;

// Matches a mention anywhere: `@word` or `@"quoted name"`.
const MENTION_RE = /@([A-Za-z0-9_.-]+)|@"([^"\n]+)"/g;

/**
 * Split message text into text and mention segments, resolving mentions against
 * the roster (id by name). Unresolvable @-references stay plain text — no dead
 * links, and no way for a message author to fabricate a link to an arbitrary
 * profile that isn't in the room.
 */
export function parseMentions(text: string, roster: Map<string, string>): MentionSegment[] {
	const byName = new Map<string, string>();
	for (const [id, name] of roster) {
		byName.set(name.toLowerCase(), id);
	}
	const segments: MentionSegment[] = [];
	let last = 0;
	for (const match of text.matchAll(MENTION_RE)) {
		const name = match[1] ?? match[2]!;
		const id = byName.get(name.toLowerCase());
		// A word char before the @ (emails, emoji codes) disqualifies the mention.
		if (!id || (match.index > 0 && /\S/.test(text[match.index - 1]!))) continue;
		if (match.index > last) {
			segments.push({ kind: "text", text: text.slice(last, match.index) });
		}
		segments.push({ kind: "mention", name, id });
		last = match.index + match[0].length;
	}
	if (last < text.length) {
		segments.push({ kind: "text", text: text.slice(last) });
	}
	return segments;
}

/**
 * Whether a username needs the quoted mention form (anything outside
 * [A-Za-z0-9_.-] — spaces, unicode, …).
 */
export function needsQuotedMention(name: string): boolean {
	return !PLAIN_NAME.test(name);
}

/**
 * The literal text for a mention of `name` — `@name` or `@"full name"`, with a
 * trailing space so typing continues right after it.
 */
export function mentionText(name: string): string {
	return needsQuotedMention(name) ? `@"${name}" ` : `@${name} `;
}

/** A live autocomplete query: the mention being typed at the caret, if any. */
export type MentionQuery = {
	/** Text typed after the @ (or inside the quotes) so far. */
	query: string;
	/** Index where the whole reference starts (the @). */
	start: number;
	/** Index where the reference ends (== caret). */
	end: number;
	/** Quote form: the reference started as `@"` and is not closed yet. */
	quoted: boolean;
};

/**
 * Find the mention being typed at `caret`, or null when the caret is not inside
 * a @-reference. Trigger rules:
 * - caret right after a fresh `@` (empty query), or
 * - caret inside/after `@word…` plain-name chars, or
 * - caret inside an unclosed `@"…`.
 * A non-space char before the @ disqualifies the trigger — a mid-word @ (emails,
 * emoji codes) is not a mention.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
	// Quote form: an `@"` opened before the caret and not yet closed — the next
	// quote (if any) is at/after the caret. indexOf === -1 means no closer at all
	// (still being typed), which counts as open.
	const open = text.lastIndexOf('@"', caret);
	const closer = open >= 0 ? text.indexOf('"', open + 2) : -2;
	if (open >= 0 && (closer === -1 || closer >= caret)) {
		if (open > 0 && /\S/.test(text[open - 1]!)) return null;
		return { query: text.slice(open + 2, caret), start: open, end: caret, quoted: true };
	}
	// Plain form: scan back over name chars, then require the @ before them.
	let i = caret;
	while (i > 0 && PLAIN_NAME.test(text[i - 1]!)) {
		i--;
	}
	// The @ must be followed immediately by the caret's name chars — but a plain
	// name can't contain "l" then space… the scan is over PLAIN_NAME chars only.
	if (i === caret && i > 0 && text[i - 1]! === "@") {
		return { query: "", start: i - 1, end: caret, quoted: false };
	}
	if (i === 0 || text[i - 1]! !== "@") {
		return null;
	}
	const start = i - 1;
	if (start > 0 && /\S/.test(text[start - 1]!)) {
		return null;
	}
	return { query: text.slice(start + 1, caret), start, end: caret, quoted: false };
}

/**
 * Filter the roster for the autocomplete list: prefix match, case-insensitive,
 * exact match first, then alphabetical. Caller decides who's in the roster
 * (bots are not offered).
 */
export function filterMentionCandidates(roster: MentionCandidate[], query: string, limit = 8): MentionCandidate[] {
	const q = query.toLowerCase();
	return roster
		.filter((c) => c.name.toLowerCase().startsWith(q))
		.sort((a, b) => {
			const ax = a.name.toLowerCase();
			const bx = b.name.toLowerCase();
			if (ax === q) return -1;
			if (bx === q) return 1;
			return ax < bx ? -1 : ax > bx ? 1 : 0;
		})
		.slice(0, limit);
}

/**
 * Replace the query being typed (the [start, end) span from mentionQueryAt) with
 * the chosen mention's literal text, returning the new full text and the caret
 * position right after the inserted mention (before its trailing space).
 */
export function applyMention(text: string, q: MentionQuery, name: string): { text: string; caret: number } {
	const literal = needsQuotedMention(name) ? `@"${name}"` : `@${name}`;
	const next = text.slice(0, q.start) + literal + " " + text.slice(q.end);
	return { text: next, caret: q.start + literal.length };
}
