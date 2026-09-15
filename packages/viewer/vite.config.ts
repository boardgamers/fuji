import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: [{ find: /^fuji-engine$/, replacement: fileURLToPath(new URL("../engine/index.ts", import.meta.url)) }],
	},
	build: {
		cssCodeSplit: false,
		// Vite requires a bundle name; registerViewer owns the fuji global.
		lib: {
			name: "fujiBundle",
			entry: "src/viewer.ts",
			formats: ["iife"],
			fileName: () => "fuji-viewer.iife.js",
		},
		rolldownOptions: { output: { assetFileNames: "fuji-viewer.[ext]" } },
	},
});
