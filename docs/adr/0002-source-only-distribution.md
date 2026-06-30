# Source-only distribution

> **Superseded by [ADR 0011](0011-compiled-distribution.md).** The central claim below — that a compiled build strips the `'use dom'` directive and makes Expo DOM Components non-functional — was shown to be false: `tsc` preserves the directive and the Expo Metro plugin detects it in compiled `node_modules` JS. The packages now ship a compiled `build/` output. Kept for history.

We ship raw TypeScript source (`src/`) without a compile step. Metro resolves `.ts` directly and the Expo Metro plugin processes the `'use dom'` directive from source files in `node_modules`. A compiled build would strip the directive, making Expo DOM components non-functional.

This trade-off accepts that consumers must use `moduleResolution: bundler` (shipped with Expo SDK 55+ projects) and that the package cannot provide pre-generated `.d.ts` for legacy TypeScript configurations. In exchange, the SDK avoids a build pipeline entirely and `'use dom'` works correctly when installed from npm.
