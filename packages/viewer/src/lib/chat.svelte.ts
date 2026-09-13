export type ChatSegment =
	| { kind: "text"; text: string }
	| { kind: "link"; text: string; url: string }
	| { kind: "mention"; id: string; name: string };
export type ChatMention = { id: string; name: string; playerIndex?: number };
export type ChatMessage = {
	_id?: string;
	author?: string;
	authorId?: string;
	playerIndex?: number;
	createdAt?: string;
	text: string;
	segments?: ChatSegment[];
	type: "text" | "system";
	editedAt?: string;
};
export class Chat {
	enabled = $state(false);
	mentions: ChatMention[] = $state([]);
	open = $state(true);
	messages: ChatMessage[] = $state([]);
	canSend = $state(false);
	disabled = $state(false);
	reason = $state("");
	draft = $state("");
	error = $state("");
	pending = $state("");
	private sent = "";
	private sequence = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;
	send: (data: { text: string; requestId: string }) => void = () => {};
	read: (messageId: string) => void = () => {};
	private newestRead = "";
	unreadIds: string[] = $state([]);
	playerIndex: number | undefined;
	get unread() {
		return this.unreadIds.filter((id) => this.messages.some((m) => m._id === id)).length;
	}
	private readTimer: ReturnType<typeof setTimeout> | undefined;
	markRead(messageId: string) {
		const index = this.messages.findIndex((m) => m._id === messageId);
		if (index >= 0) {
			const seen = new Set(this.messages.slice(0, index + 1).map((m) => m._id));
			this.unreadIds = this.unreadIds.filter((id) => !seen.has(id));
		}
		// BGS message IDs are time-ordered ObjectIds. Keep the watermark even when
		// older messages are deleted, history is replaced, or the panel is collapsed.
		if (!/^[0-9a-f]{24}$/i.test(messageId)) return;
		const id = messageId.toLowerCase();
		if (id <= this.newestRead) return;
		this.newestRead = id;
		// Coalesce newly visible messages without postponing indefinitely while scrolling.
		if (this.readTimer) return;
		this.readTimer = setTimeout(() => {
			this.readTimer = undefined;
			this.read(this.newestRead);
		}, 500);
	}
	replace(messages: ChatMessage[]) {
		this.enabled = true;
		this.messages = messages;
		this.unreadIds = [];
	}
	append(messages: ChatMessage[]) {
		this.unreadIds = [
			...this.unreadIds,
			...messages
				.filter(
					(m) =>
						m._id &&
						!this.messages.some((old) => old._id === m._id) &&
						(m.playerIndex === undefined || m.playerIndex !== this.playerIndex)
				)
				.map((m) => m._id!),
		];
		this.messages = [
			...this.messages,
			...messages.filter((m) => !m._id || !this.messages.some((old) => old._id === m._id)),
		];
	}
	submit() {
		if (!this.canSend || this.disabled || this.pending || !this.draft.trim()) return;
		this.error = "";
		this.sent = this.draft;
		this.pending = `fuji-chat-${Date.now()}-${++this.sequence}`;
		this.timer = setTimeout(() => {
			this.pending = "";
			this.error = "Delivery could not be confirmed. Check the chat before retrying.";
		}, 20000);
		this.send({ text: this.sent.trim(), requestId: this.pending });
	}
	result(result: { requestId: string; ok: boolean; error?: string }) {
		if (result.requestId !== this.pending) return;
		clearTimeout(this.timer);
		this.pending = "";
		if (result.ok) {
			if (this.draft === this.sent) this.draft = "";
		} else this.error = result.error || "Message could not be sent. Please try again.";
	}
	destroy() {
		clearTimeout(this.readTimer);
		clearTimeout(this.timer);
	}
}
