import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
export async function serveAssets(directory) {
	const root = resolve(directory);
	const server = createServer(async (req, res) => {
		try {
			const path = resolve(root, "." + new URL(req.url, "http://localhost").pathname);
			if (!path.startsWith(root + sep)) throw Error("Invalid asset path");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader(
				"Content-Type",
				{
					".js": "text/javascript; charset=utf-8",
					".css": "text/css; charset=utf-8",
					".json": "application/json",
					".webp": "image/webp",
					".jpg": "image/jpeg",
					".wasm": "application/wasm",
				}[extname(path)] || "application/octet-stream"
			);
			res.end(await readFile(path));
		} catch {
			res.writeHead(404).end();
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	server.unref();
	return `http://127.0.0.1:${server.address().port}`;
}
