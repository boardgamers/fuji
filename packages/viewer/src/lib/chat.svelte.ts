export type ChatMessage = {
	_id?: string;
	author?: string;
	authorId?: string;
	playerIndex?: number;
	createdAt?: string;
	text: string;
	type: "text" | "system";
	editedAt?: string;
};
export class Chat {
	enabled = $state(false);
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
	private readTimer: ReturnType<typeof setTimeout> | undefined;
	markRead(messageId: string) {
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
	}
	append(messages: ChatMessage[]) {
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
