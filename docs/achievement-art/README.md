# Fuji achievement artwork

Original geometric expedition badges for the existing 16 achievements, tracked in
[issue 595](https://codeberg.org/boardgamers/boardgamers/issues/595).
No award conditions, IDs, descriptions or eligibility rules change. Engine
0.1.13 → 0.1.14; achievement manifest revision 1 → 2; protocol stays 0.11.0.

## Provenance and design

`scripts/generate-achievement-art.mjs` is the editable original vector source,
licensed AGPL-3.0-only like repository code. There are **no imported images, fonts,
logos, traced illustrations or publisher-art derivatives**. New geometric
explorers, volcano, village gate, stamina gauge, pack, rope and compass form the
shared palette. This permission statement concerns these new drawings only, not
the separately licensed publisher materials described in `NOTICE.md`.

The seven map badges directly read `SCENARIOS` from `packages/engine/src/data.ts`.
Every occupied source coordinate is retained, including hollow optional V4.
Cream land squares, coral volcano/rubble, gold start circles and mint village
houses distinguish roles without relying only on color. Links denote orthogonal
adjacency, not a claimed played route. The coordinate facts are taken from the
existing implementation; no scenario-card artwork is copied. Scenarios 2 and 3
really have lower-left volcanoes, regardless of any shorthand motif description.

Lava silhouettes progress from one tongue, through two opposing fronts, to an
encircling front with a clear village approach. Stamina badges distinguish a
well-filled group reserve from a near-empty reserve and leaning explorer. The
injury badge encloses intact explorers, without suggesting healing. Equipment
uses a pack and visible card, compass and rope. Four to Safety contains exactly
four explorer figures. Other group depictions are illustrative, not additional
player-count requirements. All badges are victories under the existing evaluator.

## Reproduction and verification

Node 24+, the repository's pinned pnpm, and locked `sharp` 0.34.5 (prebuilt native
binary; its install script is explicitly disabled) are sufficient:

```sh
pnpm install --frozen-lockfile
pnpm --filter fuji-engine build
node scripts/generate-achievement-art.mjs
node scripts/verify-achievement-art.mjs
pnpm check
(cd packages/engine && pnpm pack --pack-destination ../../work/achievement-art/package)
node scripts/test-packed-achievements.mjs
```

Generated artifacts remain in ignored `work/achievement-art/`: 16 editable SVGs,
16 upload-source 512×512 PNGs, `manifest.json`, and `contact-{light,dark}-{32,48,64,128}.png`.
The circular artwork has transparent corners and is reviewed at actual small
sizes against both backgrounds. The committed manifest records source/PNG hashes,
input code/data hashes and per-asset provenance. Regeneration should match it.
PNG hashes are **not** expected to equal later server-reencoded WebP hashes.

The verifier compares all source outside the manifest function byte-for-byte with
canonical release cc865cfcbb9ba8920a647252a256e901b5f75fa4, checks all 16 keys,
decodes all images and checks hashes and uniqueness. Existing engine tests cover
all feats, exact boundaries, exclusions and replayable completed games. The exact
packed engine is exercised on 11 legal winning expeditions collectively earning
all 16 awards, comparing packed hooks to the tested build.

## Release gate

The original review candidate has now been activated; see the publication receipt
below. No upload, activation or release-branch push is performed by generation or tests. Parent-coordinated fresh
independent code **and actual visual** approval is required first. Use only the
approved current engine-only publication mechanism, never `publish-private.mjs`.
Recheck the live catalog before publication, back up metadata, upload exactly the
16 named assets, verify anonymous stored WebP bytes, then activate the exact tested
package. Record sanitized receipts and push source plus receipts non-force to
Codeberg `boardgamers/fuji` main and GitHub `boardgamers/fuji` main mirror.
Do not change viewer/settings/visibility or protocol.

## Verified publication: 0.1.14 / revision 2

[Sanitized combined activation receipt](activation-receipt-0.1.14.json) records
16 newly published achievement assets and the exact hosted engine package.
Reviewed source: `98035e6eac79cd6a9db4eff47bd05a7031f7bcde`.
Independent code/actual-visual approval reference:
`sub-1794658430705-190d54f2` (issue 595 coordination).
The receipt contains only public asset/package metadata and audit hashes, not
credentials, private metadata snapshots, or publisher authorization material.

Read-only source-delivery checks on 2026-11-14 at approximately 13:06 UTC:

- Anonymous GET of `https://boardgamers.space/api/boardgame/fuji/info/latest`
  matched engine 0.1.14, the complete revision-2 manifest, and all 16 asset refs.
- All 16 new public WebP downloads matched receipt SHA-256 and byte sizes.
  The preserved pictogram and two screenshots also matched hashes and sizes.
- Cover and English rules PDF still returned **403**: their complete preexisting
  metadata objects matched exactly. These are metadata-only preservation checks,
  **not** claims of readable bytes or verified content hashes.
- Compared the full live catalog against the preactivation version snapshot
  in memory, without copying it into this repository. Only `engine` and
  `achievementManifest` differed. Viewer, settings, visibility, options,
  preferences, tutorial, all assets, and all other fields remained unchanged.
- Original local tarball, approved envelope copy, and anonymous hosted tarball
  all matched SHA-256
  `43d83325e06002e1d982ff7925590d22e77e621d27018389cd895b22e290dfa8`
  (hosted size 40,357 bytes). No rebuild or repack was performed.
- `node scripts/verify-achievement-art.mjs` passed all 16 source artwork hashes,
  decoding, manifest references, topology/contact-sheet checks and the unchanged
  award definitions/predicates/evaluator comparison.
- `node scripts/test-packed-achievements.mjs` passed 11 legal winning expeditions,
  all 16 awards, and exact packed/source hook agreement.
- `node --test packages/engine/dist-test/src/*.spec.js` passed 102 tests using the
  retained compiled test output. The original approved-source `pnpm check` log
  remains in ignored work output; it was not rerun because it rebuilds artifacts.

Source delivery adds only this documentation and the sanitized receipt on top of
the approved source. Both fetched release tips were already ancestors (including
the GitHub `.pnpm-store` ignore baseline); no code reconciliation was needed.
Canonical delivery is Codeberg `boardgamers/fuji` main with required GitHub
`boardgamers/fuji` main mirror, using non-force pushes. This delivery performs no
production upload, POST, viewer publication, or private-publisher invocation.
