## How Publishing Works

The repository uses [Changesets](https://github.com/changesets/changesets) with GitHub Actions for automated publishing. This mirrors the flow used by [`platform-sdk-react`](https://github.com/youversion/platform-sdk-react) — the two SDKs share the same release shape so contributors don't have to relearn it per repo.

### Process

1. Developer creates a changeset with `pnpm changeset`.
2. Developer opens a PR (CI runs lint / typecheck / test / build).
3. PR merges to `main`.
4. The `Release` workflow runs and either:
   - Creates / updates the **"Version Packages"** PR (if any changesets are pending), or
   - Publishes to npm (if the "Version Packages" PR is what just merged).
5. Merging the "Version Packages" PR is the explicit human action that authorizes the publish.
6. Both packages publish to npm in dependency order with provenance attestation.

### Publishable packages

Two workspace packages ship on every release, always at the same version:

- `@youversion/platform-react-native-expo-core` (`packages/core/`)
- `@youversion/platform-react-native-expo-ui` (`packages/ui/`) — depends on `…-core` via `workspace:*`

The `fixed` group in [`.changeset/config.json`](.changeset/config.json) keeps both packages on identical versions. `pnpm release` (which Changesets invokes during publish) rewrites the `workspace:*` reference in the `…-ui` tarball to the actual published `…-core` version, so consumers see a normal version-pinned dependency.

### What gets published

The tarball ships a compiled `dist/` build (JS + `.d.ts`), not raw TypeScript — see [ADR 0011](docs/adr/0011-compiled-distribution.md). Top-level `main` / `types` point at `src/` for in-repo dev; `publishConfig` swaps them to `dist/` at publish time and `files: ["dist"]` keeps source out of the tarball.

This swap is applied by **`pnpm publish`** (which `pnpm changeset publish` uses) — *not* by `npm publish`, which would ship `main → src/index.ts` and leak source. Always release through the `Release` workflow / `pnpm changeset publish`; never raw `npm publish`.

**Before the first publish**, confirm DOM components survive the compiled build end to end: build and `pnpm pack` the UI package, install the tarball into a throwaway Expo dev build, and verify a DOM component (e.g. `BibleReader`) renders on device. ADR 0011 verified the mechanism but not a full install-and-run.

## Authentication

This repository uses **NPM Trusted Publishing** via OIDC (OpenID Connect), which eliminates the need for long-lived NPM tokens.

### How it works

1. The `Release` workflow declares `id-token: write`.
2. Each npm package is configured with GitHub Actions as a trusted publisher.
3. During publish, GitHub provides a short-lived OIDC token to npm.
4. npm validates the token and allows publishing.
5. All publishes include cryptographic provenance.

### Setting up trusted publishing

For each package, configure trusted publishing on npm:

1. Go to `https://www.npmjs.com/package/PACKAGE_NAME/access`.
2. Under "Publishing access", select "Trusted publishers".
3. Click "Add trusted publisher".
4. Configure:
   - **Provider**: GitHub Actions
   - **GitHub Organization**: `youversion`
   - **Repository**: `platform-sdk-reactnative-expo`
   - **Workflow**: `release.yml`
   - **Environment**: leave empty

Required packages:

- `@youversion/platform-react-native-expo-core`
- `@youversion/platform-react-native-expo-ui`

### NPM_TOKEN fallback (off by default)

The workflow does not carry a standing `NPM_TOKEN`. OIDC trusted publishing is the only auth path. An automation token bypasses 2FA, so a secret left in the repo widens the attack surface for little gain.

Configure trusted publishing on both packages before the first release. If a bootstrap publish must run before that is live, add a temporary fallback:

1. Generate an **Automation** token at `https://www.npmjs.com/settings/<username>/tokens`. Pick Automation, not Publish or Read-only. Automation tokens bypass 2FA, which CI cannot satisfy.
2. Add it under Settings → Secrets and variables → Actions → `NPM_TOKEN`.
3. Add `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` to the publish step env in `release.yml`.
4. Remove both the secret and that line once both packages are on trusted publishing.

## Troubleshooting

### "Version Packages" PR not created

- Confirm changesets exist in `.changeset/` directory (any `*.md` file other than `README.md`).
- Verify CI passed on `main`.
- Review `Release` workflow logs in the Actions tab.

### Publish failed

- Verify trusted publishing is configured for both packages on npm.
- Check that the GitHub Actions workflow has `id-token: write`.
- Confirm npm permissions for `@youversion` scope.
- Review `Release` workflow logs.

### Need to unpublish

Unpublish and deprecate are manual steps. They run from a maintainer's machine and need npm publish rights on the `@youversion` scope. The release workflow does not do this for you.

Cannot unpublish after 72 hours. Within 72 hours:

```bash
npm unpublish @youversion/platform-react-native-expo-ui@<version>
npm unpublish @youversion/platform-react-native-expo-core@<version>
```

**Prefer** publishing a patch with the fix.

### Deprecate a version

```bash
npm deprecate @youversion/platform-react-native-expo-ui@1.0.0 "Use 1.0.1+ - fixes critical bug"
```

### Package not showing on npm

- Check npm status page.
- Ensure `publishConfig.access: "public"` in `packages/ui/package.json` and `packages/core/package.json`.
- Review `Release` workflow logs.

### React-Native-specific failure modes

For RN-specific issues that don't apply to plain web SDKs (peer-dep version skew with consumer projects, `workspace:*` not being rewritten, Expo prebuild interactions), see [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md).

## Manual publishing (emergency only)

**Important:** manual publishing from local machines is not supported with trusted publishing. Packages are intended to ship only via the `Release` workflow.

If the workflow is broken and a release must go out:

1. Fix the workflow, or
2. Re-trigger the release by pushing a fix commit to the "Version Packages" PR or re-running the workflow from the Actions UI.

If you absolutely must publish manually (requires npm account access with publish rights to `@youversion`):

```bash
# 1. Apply any pending changesets (creates the version bumps + changelog entries)
pnpm version-packages

# 2. Build all packages
pnpm build

# 3. Publish (requires npm authentication)
npm login
pnpm release
```

Manual publishes do **not** include OIDC provenance unless your local npm CLI is set up for it.

## Monitoring releases

### GitHub Actions

1. Actions tab → `CI` workflow (PRs) and `Release` workflow (main branch).

### NPM

- `https://www.npmjs.com/package/@youversion/platform-react-native-expo-core`
- `https://www.npmjs.com/package/@youversion/platform-react-native-expo-ui`

Verify the version updated and the provenance badge is present.

### Git tags

```bash
git fetch --tags
git tag -l "@youversion/platform-react-native-expo-*"
```

## Resources

- [Changesets documentation](https://github.com/changesets/changesets)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [`platform-sdk-react` PUBLISHING.md](https://github.com/youversion/platform-sdk-react/blob/main/PUBLISHING.md) — sibling repo using the same flow
