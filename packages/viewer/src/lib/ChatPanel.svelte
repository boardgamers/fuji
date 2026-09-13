<script lang="ts">
	import { tick } from "svelte";
	import type { Store } from "./store.svelte";
	import { mentionQueryAt, applyMention } from "@boardgamers/protocol/chat";
	let { store }: { store: Store } = $props();
	const chat = $derived(store.chatState);
	let composer: HTMLInputElement | undefined = $state();
	let caret = $state(0);
	let choice = $state(0);
	let dismissed = $state(false);
	const query = $derived(dismissed ? null : mentionQueryAt(chat.draft, caret));
	const candidates = $derived.by(() => {
		void chat.mentions;
		void chat.playerIndex;
		return query ? store.chat.suggestions(query.query) : [];
	});
	async function chooseMention(name: string) {
		if (!query) return;
		const next = applyMention(chat.draft, query, name);
		store.chat.setDraft(next.text);
		caret = next.caret + 1;
		dismissed = true;
		await tick();
		composer?.focus();
		composer?.setSelectionRange(caret, caret);
	}
	function safeLink(url: string) {
		return /^https?:\/\//i.test(url);
	}

	let list: HTMLDivElement | undefined = $state();
	let contents: HTMLDivElement | undefined = $state();
	let scrollFrame: number | undefined;
	let pinned = true;
	const colors = ["#e6c780", "#83ca90", "#80c5d7", "#d999b8"];
	const notice = $derived(
		chat.disabled
			? "Chat is disabled."
			: ({
					"not-logged-in": "Sign in to chat.",
					"not-confirmed": "Confirm your account to chat.",
					"not-a-player": "Only participants can send messages.",
					"chat-disabled": "Chat is disabled.",
				}[chat.reason] ?? "Chat is read-only.")
	);
	function visibleRead() {
		if (!list || !chat.open || document.visibilityState !== "visible" || !document.hasFocus()) return;
		const bounds = list.getBoundingClientRect();
		if (!bounds.width || !bounds.height) return;
		const rows = [...list.querySelectorAll<HTMLElement>("[data-message-id]")];
		const latest = rows.reverse().find((row) => {
			const r = row.getBoundingClientRect();
			return r.bottom <= Math.min(bounds.bottom, window.innerHeight) && r.bottom > Math.max(bounds.top, 0);
		});
		const id = latest?.dataset.messageId;
		if (id) store.chat.markRead(id);
	}
	function followLatest() {
		if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
		scrollFrame = requestAnimationFrame(() => {
			if (list && pinned) list.scrollTop = list.scrollHeight;
			scrollFrame = undefined;
			visibleRead();
		});
	}
	$effect(() => {
		const element = list;
		chat.messages;
		chat.open;
		if (!element || !chat.open) return;
		let disposed = false;
		void tick().then(() => {
			if (!disposed) {
				followLatest();
			}
		});
		const observer = new IntersectionObserver(visibleRead);
		observer.observe(element);
		// BGS can reveal the iframe or finish loading its stylesheet after history arrives.
		// Follow changes to the viewport and message heights, including late avatar/font loads.
		const resize = new ResizeObserver(followLatest);
		resize.observe(element);
		if (contents) resize.observe(contents);
		return () => {
			disposed = true;
			observer.disconnect();
			resize.disconnect();
			if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
			scrollFrame = undefined;
		};
	});
</script>

<svelte:window onfocus={visibleRead} onscroll={visibleRead} />
<svelte:document onvisibilitychange={visibleRead} />
{#if chat.enabled}
	<section class="expedition-chat" aria-label="Expedition chat">
		<header>
			<h2>Expedition chat</h2>
			<button
				class="text-button"
				aria-label={chat.open ? "Collapse chat" : "Expand chat"}
				aria-expanded={chat.open}
				onclick={() => {
					store.chat.setOpen(!chat.open);
					pinned = true;
				}}>{chat.open ? "−" : "+"}</button
			>
		</header>
		{#if chat.open}
			<div
				class="chat-messages"
				bind:this={list}
				role="region"
				aria-label="Chat messages"
				tabindex="0"
				onscroll={() => {
					if (list && scrollFrame === undefined) pinned = list.scrollHeight - list.scrollTop - list.clientHeight < 32;
					visibleRead();
				}}
			>
				<div bind:this={contents}>
					{#if !chat.messages.length}<p class="empty">Plan your escape together.</p>{/if}
					{#each chat.messages as message, i (message._id ?? i)}
						<article data-message-id={message._id} class:system={message.type === "system"}>
							{#if message.author}
								<div class="chat-author">
									{#if message.playerIndex !== undefined}
										<button
											style:color={colors[message.playerIndex]}
											onclick={() => store.clickPlayer(message.playerIndex!)}
										>
											{#if store.avatars[message.playerIndex]}<img
													src={store.avatars[message.playerIndex]}
													alt=""
												/>{/if}{message.author}
										</button>
									{:else}<strong>{message.author}</strong>{/if}
									{#if message.createdAt}<time
											datetime={message.createdAt}
											title={new Date(message.createdAt).toLocaleString()}
											>{new Date(message.createdAt).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}</time
										>{/if}
									{#if message.editedAt}<span title={new Date(message.editedAt).toLocaleString()}>edited</span>{/if}
								</div>
							{/if}
							<p>
								{#each message.segments ?? [{ kind: "text" as const, text: message.text }] as segment}
									{#if segment.kind === "link" && safeLink(segment.url)}<a
											href={segment.url}
											target="_blank"
											rel="noopener noreferrer">{segment.text}</a
										>
									{:else if segment.kind === "mention"}{@const player = chat.mentions.find((p) => p.id === segment.id)}
										{#if player?.playerIndex !== undefined}<button
												class="chat-mention"
												onclick={() => store.clickPlayer(player.playerIndex!)}>@{segment.name}</button
											>
										{:else}<a
												class="chat-mention"
												href={`https://boardgamers.space/user/${encodeURIComponent(segment.name)}`}
												target="_blank"
												rel="noopener noreferrer">@{segment.name}</a
											>{/if}
									{:else}{segment.text}{/if}
								{/each}
							</p>
						</article>
					{/each}
				</div>
			</div>
			{#if chat.canSend && !chat.disabled}
				{#if candidates.length}<div class="mention-choices" aria-label="Mention a teammate">
						{#each candidates as candidate, i}<button
								type="button"
								class:selected={i === choice}
								onmousedown={(e) => e.preventDefault()}
								onclick={() => chooseMention(candidate.name)}>@{candidate.name}</button
							>{/each}
					</div>{/if}
				<div class="chat-composer">
					<input
						type="text"
						aria-label="Chat message"
						placeholder="Message your teammates…"
						value={chat.draft}
						bind:this={composer}
						oninput={(event) => {
							store.chat.setDraft(event.currentTarget.value);
							caret = composer?.selectionStart ?? 0;
							choice = 0;
							dismissed = false;
						}}
						onclick={() => {
							caret = composer?.selectionStart ?? 0;
							dismissed = false;
						}}
						onkeydown={(event) => {
							if (!event.isComposing && candidates.length) {
								if (event.key === "ArrowDown" || event.key === "ArrowUp") {
									event.preventDefault();
									choice = (choice + (event.key === "ArrowDown" ? 1 : candidates.length - 1)) % candidates.length;
									return;
								}
								if (event.key === "Escape") {
									event.preventDefault();
									dismissed = true;
									return;
								}
								if (event.key === "Enter" || event.key === "Tab") {
									event.preventDefault();
									void chooseMention(candidates[choice]?.name ?? candidates[0]!.name);
									return;
								}
							}
							if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
								event.preventDefault();
								store.chat.submit();
							}
						}}
					/>
					<button
						class="chat-send"
						disabled={!!chat.pending || !chat.draft.trim()}
						type="button"
						onclick={() => store.chat.submit()}>{chat.pending ? "Sending…" : "Send"}</button
					>
				</div>
			{:else}<p class="notice">{notice}</p>{/if}
			{#if chat.error}<p class="chat-error" role="alert">{chat.error}</p>{/if}
		{/if}
	</section>
{/if}

<style>
	.chat-mention {
		color: var(--gold, #e6c780);
		font: inherit;
		font-weight: 600;
		padding: 0 2px;
		background: #e6c78015;
		border: 0;
		cursor: pointer;
	}
	.mention-choices {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px 0;
	}
	.mention-choices button {
		color: #f1e6bf;
		background: #203b32;
		border: 1px solid #e6c78055;
		padding: 5px 8px;
	}
	.mention-choices button.selected {
		border-color: #e6c780;
		background: #365348;
	}
	article p a {
		color: #9ed9ea;
		text-decoration: underline;
		overflow-wrap: anywhere;
	}

	.expedition-chat {
		border-top: 1px solid #e6c78030;
		padding: 12px;
		border: 1px solid #e6c78030;
		border-radius: 3px;
		background: #102a23;
		min-width: 0;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	h2 {
		font-size: 19px;
		margin: 0;
		font-weight: 500;
	}
	.chat-messages {
		height: clamp(140px, 22vh, 250px);
		overflow: auto;
		overscroll-behavior: contain;
		overflow-anchor: none;
		margin: 14px 0;
	}
	article {
		padding: 8px 0;
		border-bottom: 1px solid #ffffff0a;
	}
	.chat-author {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 14px;
		flex-wrap: wrap;
	}
	.chat-author button {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.chat-author button:hover {
		text-decoration: underline;
	}
	img {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		object-fit: cover;
	}
	time,
	.chat-author span {
		color: #93aea2;
		font-size: 12px;
	}
	p {
		margin: 5px 0;
		font-size: 15px;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.system,
	.empty,
	.notice {
		color: #a5bdb0;
	}
	.chat-composer {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	input {
		flex: 1;
		min-width: 0;
		background: #0b211c;
		color: #f5ebce;
		border: 1px solid #6d8976;
		border-radius: 5px;
		padding: 4px 8px;
		font: inherit;
		font-size: 15px;
	}
	input:focus-visible {
		outline: 2px solid #e6c780;
		outline-offset: 2px;
	}
	input,
	.chat-send {
		box-sizing: border-box;
		height: 34px;
		line-height: 20px;
	}
	.chat-send {
		background: #e6c780;
		color: #142a22;
		border: 0;
		border-radius: 5px;
		padding: 4px 12px;
		white-space: nowrap;
		font-weight: 600;
		cursor: pointer;
	}
	.chat-send:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.chat-error {
		color: #ffbd98;
	}
</style>
