# PRD: Package @youversion/platform-react-native-expo for npm Distribution

## Problem Statement

Partners and solo developers want to add Bible components (reader, verse of the day, Bible card, text view, chapter picker) to their React Native Expo apps. Today the SDK lives in a monorepo with no published package — there is no way for an external consumer to install it. The packaging must also satisfy a hard constraint: Expo DOM components with the `'use dom'` directive require raw source files because the Expo Metro plugin processes the directive at build time from `node_modules`.

## Solution

Publish `@youversion/platform-react-native-expo` to the public npm registry as a source-only TypeScript package. Configure `package.json` with proper entry points (`main`, `react-native`, `exports`, `types`), dependency boundaries (auto-install web SDK deps, peer-install `react-dom` to prevent duplicates), and metadata matching the existing `@youversion/platform-*` packages. Consumers run `pnpm add @youversion/platform-react-native-expo` and install one set of peer deps.

## User Stories

1. As a solo developer, I want to install one package and get Bible components working, so that I don't have to understand the Web SDK dependency chain.
2. As a solo developer, I want TypeScript types to work out of the box, so that my IDE gives me autocomplete and type checking.
3. As a partner developer building web + native, I want `react-dom` as a peer dep, so that I don't get duplicate React instance crashes.
4. As a partner developer, I want the package to auto-install `@youversion/platform-react-ui` and `@youversion/platform-react-hooks`, so that I don't have to discover and install them manually.
5. As a consumer, I want peer deps to include transitive native requirements (reanimated, gesture-handler, etc.), so that I get clear warnings if I'm missing a runtime dependency.
6. As a consumer on Expo SDK 55, I want the package to work without any Metro config changes, so that my build "just works."
7. As a consumer, I want the `exports` field to support `react-native` conditional resolution, so that Metro resolves the correct entry point.
8. As a future maintainer, I want to understand why there's no build step, so that I don't accidentally add one and break `'use dom'`.
9. As a future maintainer, I want the dependency boundary documented in CONTEXT.md, so that I know which deps are auto-installed vs peer-installed and why.
10. As a consumer, I want a `files` field that excludes tests and dev configs, so that the package is small.
11. As a consumer, I want the package to declare `Apache-2.0` license and npm provenance, so that I can use it commercially and verify supply chain integrity.
12. As a consumer, I want the `expo` peer dep range to be validated (not speculative), so that I don't hit runtime bugs on an untested SDK version.

## Implementation Decisions

### Source-only distribution

Ship raw TypeScript `src/` with no compile step. The Expo Metro plugin processes `'use dom'` directives from source files in `node_modules`. A compiled build would strip the directive, making all Expo DOM Components non-functional. Documented in ADR-0002 (`docs/adr/0002-source-only-distribution.md`).

### Entry points

- `main`: `src/index.ts`
- `react-native`: `src/index.ts`
- `source`: `src/index.ts`
- `types`: `src/index.ts`
- `exports`: `react-native` condition pointing to `src/index.ts`, plus `types` condition

Consumers must use `moduleResolution: bundler` (default in Expo SDK 55+ projects).

### Dependency boundary

| Package | Field | Rationale |
|---|---|---|
| `@youversion/platform-react-ui` | `dependencies` | Auto-installed for one-install DX |
| `@youversion/platform-react-hooks` | `dependencies` | Auto-installed for one-install DX |
| `react-dom` | `peerDependencies` `>=19.1.0 <20.0.0` | Prevent duplicate React instances in web+native apps; range aligned with Web SDK |

All other current peer deps remain as-is (transitive native requirements for consumer safety).

### `exports` field shape

```json
"exports": {
  ".": {
    "types": "./src/index.ts",
    "react-native": "./src/index.ts",
    "default": "./src/index.ts"
  },
  "./package.json": "./package.json"
}
```

### `files` field

```json
"files": ["src"]
```

No tests exist yet. When added, exclude with `"!src/**/__tests__"`.

### `sideEffects`

Omit entirely. `createMMKV` has a top-level side effect (creates native storage instance). Defaults to `true`, which is safe.

### Metadata (matching `@youversion/platform-react-ui`)

- `license`: `Apache-2.0`
- `repository`: `{ "type": "git", "url": "git+https://github.com/youversion/platform-sdk-reactnative-expo.git" }`
- `publishConfig`: `{ "access": "public", "registry": "https://registry.npmjs.org/", "provenance": true }`
- `description`: TBD by implementer
- `keywords`: `["react-native", "expo", "youversion", "bible", "sdk"]`
- `homepage`: `https://github.com/youversion/platform-sdk-reactnative-expo#readme`
- `bugs`: `{ "url": "https://github.com/youversion/platform-sdk-reactnative-expo/issues" }`

### Versioning

Independent semver, starting at `0.0.1`. Not lockstepped with `@youversion/platform-react-ui`.

### Expo SDK peer dep range

`>=55.0.0 <56.0.0` — validated against SDK 55 only. Widen after testing against SDK 56.

### CONTEXT.md updates

Add two terms:
- **Source-Only Distribution** — with rationale and `moduleResolution` requirement
- **Dependency Boundary** — with the deps/peer-deps split rationale

Add two relationships documenting the packaging constraints.

Already applied in this session.

## Testing Decisions

- No automated tests for packaging configuration (it's declarative `package.json` fields).
- Manual validation: install the package into a fresh Expo SDK 55 app via `pnpm add` and verify that Metro resolves types and `'use dom'` components render.
- Verify `npm pack --dry-run` output contains only `src/` files and no tests, configs, or build artifacts.

## Out of Scope

- CI/CD publish pipeline (GitHub Actions, npm publish automation)
- Consumer-facing getting-started guide / README update
- Migration guide for existing monorepo consumers
- EAS Update bundle size optimization (compiled output for smaller OTA diffs)
- Expo config plugin or autolinking script
- Web platform fallback or browser-specific exports

## Further Notes

- ADR-0002 created at `docs/adr/0002-source-only-distribution.md`
- CONTEXT.md updated with **Source-Only Distribution** and **Dependency Boundary** terms and relationships
- The existing example app (`apps/example`) already validates the source-only approach via `workspace:*` resolution — the packaging change is purely a `package.json` configuration task
- `'use dom'` from `node_modules` is confirmed working by the existing monorepo setup and is the only viable approach per Expo's architecture (see SO question and Expo docs research)
