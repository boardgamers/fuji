// Top-layer previews avoid clipping inside the scrolling player strip.
export function equipmentPopover(node: HTMLButtonElement) {
	const preview = node.nextElementSibling as HTMLElement;
	let pinned = false;
	const toggled = () => {
		if (!preview.matches(":popover-open")) pinned = false;
	};
	const close = () => {
		pinned = false;
		preview.hidePopover();
	};
	const open = () => {
		preview.showPopover();
		const anchor = node.getBoundingClientRect();
		const box = preview.getBoundingClientRect();
		const width = document.documentElement.clientWidth;
		preview.style.left = `${Math.max(8, Math.min(anchor.left, width - box.width - 8))}px`;
		preview.style.top = `${Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - box.height - 8))}px`;
	};
	const enter = (e: PointerEvent) => {
		if (e.pointerType === "mouse") open();
	};
	const leave = () => {
		if (!pinned) close();
	};
	const click = () => {
		if (pinned) close();
		else {
			open();
			pinned = true;
		}
	};
	preview.addEventListener("toggle", toggled);
	node.addEventListener("pointerenter", enter);
	node.addEventListener("pointerleave", leave);
	node.addEventListener("focus", open);
	node.addEventListener("blur", leave);
	node.addEventListener("click", click);
	window.addEventListener("resize", close);
	window.addEventListener("scroll", close, true);
	return {
		destroy() {
			preview.removeEventListener("toggle", toggled);
			node.removeEventListener("pointerenter", enter);
			node.removeEventListener("pointerleave", leave);
			node.removeEventListener("focus", open);
			node.removeEventListener("blur", leave);
			node.removeEventListener("click", click);
			window.removeEventListener("resize", close);
			window.removeEventListener("scroll", close, true);
		},
	};
}
