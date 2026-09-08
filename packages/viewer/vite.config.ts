import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
export default defineConfig({
	plugins: [svelte()],
	build: {
		cssCodeSplit: false,
		lib: { entry: "src/viewer.ts", name: "fuji", formats: ["iife"], fileName: () => "fuji-viewer.iife.js" },
		rolldownOptions: { output: { assetFileNames: "fuji-viewer.[ext]" } },
	},
});
