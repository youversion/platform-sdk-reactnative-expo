# Source-only distribution

We ship raw TypeScript source (`src/`) without a compile step. Metro resolves `.ts` directly and the Expo Metro plugin processes the `'use dom'` directive from source files in `node_modules`. A compiled build would strip the directive, making Expo DOM components non-functional.

This trade-off accepts that consumers must use `moduleResolution: bundler` (shipped with Expo SDK 55+ projects) and that the package cannot provide pre-generated `.d.ts` for legacy TypeScript configurations. In exchange, the SDK avoids a build pipeline entirely and `'use dom'` works correctly when installed from npm.
