## Learned User Preferences

- One published package (`@youversion/platform-react-native-expo`) with internal folders, not multiple sub-packages

## Learned Workspace Facts

- pnpm monorepo with Turborepo; `node-linker=hoisted` in `.npmrc` required for Expo DOM + pnpm compatibility
- Expo SDK 55 with DOM components wrapping the React Web SDK (`@youversion/platform-react-ui`)
- Package structure: `packages/sdk/src/{dom,native,lib}/` — DOM wrappers, RN components, shared adapters
- Example app lives in `apps/example/` using expo-router with tabs layout
- Metro config should stay minimal; Expo SDK 52+ auto-configures monorepos (don't manually set `watchFolders`/`resolver.*`)
- Root `tsconfig.json` excludes `apps/example`; the app has its own `tsconfig.json` extending root with `exclude` override
- Web SDK DOM dependencies (localStorage, DOMParser, CSS injection) don't work natively — Expo DOM components provide a WebView-based DOM environment that handles them
- Font/theme overrides in DOM components use CSS custom properties on `[data-slot="yv-bible-renderer"]`
- `expo install --fix` resolves package version conflicts in the Expo ecosystem
- `apps/example` needs `index.js` entry re-exporting `expo-router/entry` for Metro monorepo resolution
