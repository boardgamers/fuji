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
		lib: { entry: "src/viewer.ts", name: "fuji", formats: ["iife"], fileName: () => "fuji-viewer.iife.js" },
		rolldownOptions: { output: { assetFileNames: "fuji-viewer.[ext]" } },
	},
});
