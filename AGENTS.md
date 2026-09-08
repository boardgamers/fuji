# Fuji development

Use English for code, identifiers, documentation, tests and source UI strings.

- Node 24+, pnpm workspace, TypeScript strict, Svelte 5 runes.
- Run `pnpm check` before commits; run simulation when changing state transitions.
- Apply moves to a clone and validate before returning. Invalid actions must leave the input state and RNG counter unchanged.
- All gameplay randomness uses the seed and counter in engine state. Never use `Math.random` in the engine.
- Never expose seed, counter, deck order, private roll history or hidden dice through viewer state, logs or helpers. The local hot-seat harness is intentionally separate from the BGS bundle.
- Rules data comes from the supplied production files. Record uncertain interpretations in `docs/rules-status.md`; do not silently invent rule data.
- Keep source assets separate from the source-code license. Do not upload the original production PDFs to the repository.
- Match BGS's emitter contract; do not implement a second postMessage bridge. Uplink payloads must be plain serializable values.
- The beta is not ready for publication until the platform clock and cooperative result concerns in `docs/bgs-integration.md` are resolved or explicitly bounded for a private test.
