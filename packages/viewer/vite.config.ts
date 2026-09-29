import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
export default defineConfig({
	base: "./",
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
		rolldownOptions: {
			output: {
				assetFileNames: (asset) =>
					asset.names?.some((n) => n.endsWith(".css")) ? "fuji-viewer.css" : "[name]-[hash][extname]",
			},
		},
	},
});
