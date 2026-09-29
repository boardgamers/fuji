import { uploadViewerFiles } from "./viewer-files.mjs";
// Private BGS release. Credentials are read from a file, never logged or embedded.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { homedir } from "node:os";
const base = "https://admin.boardgamers.space/api";
const token = readFileSync(process.env.BGS_TOKEN_FILE || `${homedir()}/.bgs`, "utf8").trim();
async function request(path, method = "GET", body, raw = false) {
	const response = await fetch(base + path, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			...(body ? { "Content-Type": raw ? "application/octet-stream" : "application/json" } : {}),
		},
		body: body ? (raw ? body : JSON.stringify(body)) : undefined,
	});
	if (!response.ok) throw Error(`${method} ${path}: ${response.status} ${(await response.text()).slice(0, 800)}`);
	return response.json();
}
const version = "/admin/gameinfo/fuji/1";
const draft = JSON.parse(readFileSync("bgs-gameinfo.draft.json", "utf8"));
assert.equal(draft.public, false);
const versions = await request("/admin/gameinfo/fuji/versions");
if (versions.length) {
	const existing = await request(version);
	if (versions.length !== 1 || existing.public !== false || existing.viewer?.url || existing.engine?.package?.url)
		throw Error("Fuji already exists. Review its current version before uploading a replacement.");
}
await request(version, "PUT", {
	...draft,
	...(versions.length ? { unlisted: true } : {}),
	rules: "[How to play Fuji](https://boardgamers.space/page/fuji/rules)",
});
console.log("Registered private Fuji v1.");
await request(version + "/engine", "POST", readFileSync(`fuji-engine-${draft.engine.package.version}.tgz`), true);
const files = await uploadViewerFiles(
	"packages/viewer/dist",
	"fuji-viewer.iife.js",
	["fuji-viewer.css"],
	(query, bytes) => request(version + "/viewer/file?" + query, "POST", bytes, true)
);
const js = { url: files.url },
	css = { url: files.stylesheets[0] };
const current = await request(version);
await request(version, "PUT", {
	...current,
	alias: current.alias ?? null,
	public: false,
	viewer: {
		...draft.viewer,
		chat: true,
		url: js.url,
		scriptBytes: files.scriptBytes,
		dependencies: { scripts: [], stylesheets: [css.url] },
	},
});
await request("/admin/page/fuji:rules/en", "PUT", {
	title: "Fuji: how to play",
	content: readFileSync("docs/rules.md", "utf8"),
});
for (const usernameOrEmail of ["Spock", "AlphaZero"]) {
	const grant = await request("/admin/gameinfo/fuji/beta-users", "POST", { usernameOrEmail });
	console.log(`Granted ${grant.username} access to v${grant.maxVersion}.`);
}
const saved = await request(version);
assert.equal(saved.public, false);
assert(saved.engine.package.url);
assert.equal(saved.viewer.url, js.url);
for (const url of [saved.engine.package.url, js.url, css.url]) {
	const response = await fetch(url, { method: "HEAD" });
	assert(response.ok, `Hosted asset unavailable: ${response.status}`);
}
const rules = await request("/admin/page/fuji:rules/en");
assert(rules.content.includes("seven scenarios"));
console.log("Private release, hosted assets and rules verified.");
