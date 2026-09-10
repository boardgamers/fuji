<script lang="ts">
	import { tick } from "svelte";
	import type { Store } from "./store.svelte";
	let { store }: { store: Store } = $props();
	const chat = $derived(store.chat);

	let list: HTMLDivElement | undefined = $state();
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
		const rows = [...list.querySelectorAll<HTMLElement>("[data-message-id]")];
		const latest = rows.reverse().find((row) => {
			const r = row.getBoundingClientRect();
			return r.bottom <= Math.min(bounds.bottom, window.innerHeight) && r.bottom > Math.max(bounds.top, 0);
		});
		const id = latest?.dataset.messageId;
		if (id) chat.markRead(id);
	}
	$effect(() => {
		const element = list;
		chat.messages;
		chat.open;
		if (!element || !chat.open) return;
		let disposed = false;
		void tick().then(() => {
			if (!disposed) {
				if (pinned) element.scrollTop = element.scrollHeight;
				visibleRead();
			}
		});
		const observer = new IntersectionObserver(visibleRead);
		observer.observe(element);
		return () => {
			disposed = true;
			observer.disconnect();
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
					chat.open = !chat.open;
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
					if (list) pinned = list.scrollHeight - list.scrollTop - list.clientHeight < 32;
					visibleRead();
				}}
			>
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
										>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time
									>{/if}
								{#if message.editedAt}<span title={new Date(message.editedAt).toLocaleString()}>edited</span>{/if}
							</div>
						{/if}
						<p>{message.text}</p>
					</article>
				{/each}
			</div>
			{#if chat.canSend && !chat.disabled}
				<form
					onsubmit={(event) => {
						event.preventDefault();
						chat.submit();
					}}
				>
					<textarea
						aria-label="Chat message"
						placeholder="Message your teammates…"
						rows="2"
						bind:value={chat.draft}
						onkeydown={(event) => {
							if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
								event.preventDefault();
								chat.submit();
							}
						}}></textarea>
					<button class="chat-send" disabled={!!chat.pending || !chat.draft.trim()} type="submit"
						>{chat.pending ? "Sending…" : "Send"}</button
					>
				</form>
			{:else}<p class="notice">{notice}</p>{/if}
			{#if chat.error}<p class="chat-error" role="alert">{chat.error}</p>{/if}
		{/if}
	</section>
{/if}

<style>
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
	form {
		display: flex;
		gap: 10px;
		align-items: stretch;
	}
	textarea {
		flex: 1;
		min-width: 0;
		background: #0b211c;
		color: #f5ebce;
		border: 1px solid #6d8976;
		border-radius: 5px;
		padding: 10px;
		font: inherit;
		font-size: 15px;
		resize: vertical;
	}
	textarea:focus-visible {
		outline: 2px solid #e6c780;
		outline-offset: 2px;
	}
	.chat-send {
		background: #e6c780;
		color: #142a22;
		border: 0;
		border-radius: 5px;
		padding: 8px 12px;
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
