# Release Runbook (RN-specific)

When a release encounters something that the generic Changesets / npm flow doesn't cover, this runbook is the place to look. For the normal happy-path flow and generic publish troubleshooting (auth, "Version Packages" PR not appearing, deprecate / unpublish), see [PUBLISHING.md](./PUBLISHING.md).

This runbook covers the failure modes that are specific to publishing a React Native SDK and that aren't already handled by [`changesets/action`](https://github.com/changesets/action). If you're looking for the old bespoke-workflow recovery catalogue (resume mode, dispatched-workflow tag scenarios, etc.), it's no longer applicable — the release pipeline is the Changesets flow described in [PUBLISHING.md](./PUBLISHING.md).

---

## 1. `workspace:*` was not rewritten in the published `ui` tarball

**Symptom.** Consumers install `@youversion/platform-react-native-expo-ui@$VERSION` and see an error like `Cannot resolve workspace:* outside a workspace` or `Unsupported URL Type "workspace:": workspace:*` in their install logs.

**Why it happens.** `pnpm publish` (invoked indirectly by `changeset publish`) is supposed to rewrite `workspace:*` at pack time. If the publish happened through a non-pnpm tool, or with an unusual `publishConfig`, the literal `workspace:*` reference can ship in the tarball.

**State check.**

```bash
mkdir -p /tmp/inspect-ui && cd /tmp/inspect-ui
npm pack "@youversion/platform-react-native-expo-ui@$VERSION"
tar -xzf youversion-platform-react-native-expo-ui-${VERSION}.tgz
node -p "require('./package/package.json').dependencies"
```

The `…-core` dependency should be `^$VERSION` (or `~$VERSION`), not `workspace:*`.

**Recovery.** If the published tarball is broken:

1. Mark the broken version: `npm dist-tag rm @youversion/platform-react-native-expo-ui latest` (so `latest` doesn't point at it), then optionally `npm deprecate @youversion/platform-react-native-expo-ui@$VERSION "broken workspace:* — use ${NEXT_VERSION}"`.
2. Land a fix on `main` (the most common cause is a `publishConfig` edit that confused pnpm) and let Changesets ship a patch.

**Why not just unpublish?** npm's 72-hour unpublish window has narrowed historically; treat `npm unpublish` as best-effort and prefer deprecation + a patch release.

---

## 2. Peer-dep version skew with consumer projects

**Symptom.** Consumers report install errors like `incorrect peer dependency` or runtime errors like `Module RNCSafeAreaContext is null` after upgrading to a new SDK version. Their `react-native` / `expo` / `react-native-reanimated` / `react-native-mmkv` / `react-native-safe-area-context` / etc. doesn't satisfy the SDK's `peerDependencies` range.

**State check.** Read the released package's peer ranges:

```bash
npm view @youversion/platform-react-native-expo-ui@$VERSION peerDependencies
npm view @youversion/platform-react-native-expo-core@$VERSION peerDependencies
```

Cross-reference with the consumer's `package.json`.

**Recovery — two options:**

- **Consumer upgrades.** Document required peer-dep ranges in the GitHub release notes. Consumers update their RN / Expo / native modules to a satisfying version.
- **SDK widens the range.** If a swath of consumers is affected and the SDK *would actually work* with the older peer-dep, ship a patch widening `peerDependencies`. Be conservative — widening too far papers over a real incompatibility and produces opaque runtime crashes.

**Prevention.** When bumping a major peer range (e.g. `expo >=55` → `expo >=56`), describe the consumer impact in the changeset body. The changeset becomes part of the release notes consumers will read before upgrading.

---

## 3. Future native artifact failures (currently no-op)

This SDK is currently pure TypeScript — no `.h` / `.m` / `.swift` / `.kt` / `.java` / `.podspec` / `.gradle` / codegen specs ship in the tarballs. The following failure classes are stubbed out today and become live if native sources are ever added directly to the published packages:

| Class | What to watch for if/when native code lands |
|---|---|
| iOS / Android source stamps drift from `package.json#version` | Add a pre-publish check that the version stamped in podspec / `build.gradle` / native constants matches `package.json#version`. |
| Codegen output missing from published tarball | `npm pack` + `tar -tzf` post-publish to verify codegen-emitted files are present. |
| Hermes / new-arch / old-arch partial publish | If the SDK ever ships arch-specific artifacts, they need to publish atomically. |

When any of these become real, mirror the pattern from [`platform-sdk-swift`'s RELEASE-RUNBOOK.md](https://github.com/youversion/platform-sdk-swift/blob/main/RELEASE-RUNBOOK.md) for the CocoaPods analogs.
