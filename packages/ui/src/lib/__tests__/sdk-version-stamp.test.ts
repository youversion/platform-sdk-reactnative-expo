import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

// The publish stamp lives in scripts/ as a single `.cjs` so Node can run it at
// publish time with no build step, while this test requires the same file and
// exercises the pure transform. The file-IO block is guarded by
// `require.main === module`, so requiring it here never touches the filesystem.
// See docs/adr/0012-sdk-version-stamp-on-publish.md.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stampPublishBuild, SENTINEL, STAMPED } = require('../../../scripts/stamp-sdk-version.cjs')

// Mirrors the shape of the compiled build/lib/sdk-version.js: the flag, plus the
// ternary whose dead else branch keeps `-dev` in every build.
const COMPILED = [
  "import pkg from '../../package.json';",
  'const IS_PUBLISH_BUILD = false;',
  'export const SDK_VERSION = IS_PUBLISH_BUILD ? pkg.version : `${pkg.version}-dev`;',
  "const SDK_HEADER_NAME = 'x-yvp-sdk';",
  '',
].join('\n')

describe('stampPublishBuild', () => {
  it('flips the build-channel flag to true', () => {
    const out = stampPublishBuild(COMPILED)
    expect(out).toContain(STAMPED)
    expect(out).not.toContain(SENTINEL)
  })

  it('leaves the surrounding lines untouched', () => {
    const out = stampPublishBuild(COMPILED)
    expect(out).toContain("const SDK_HEADER_NAME = 'x-yvp-sdk';")
    expect(out).toContain("import pkg from '../../package.json';")
  })

  it('throws if the anchor is missing (fails closed, never ships -dev)', () => {
    // Stands in for tooling that folded or minified the constant away: neither
    // literal survives, so the build channel cannot be confirmed.
    expect(() => stampPublishBuild('export const SDK_VERSION = pkg.version;')).toThrow(/found 0/)
  })

  it('throws if the anchor appears more than once', () => {
    expect(() => stampPublishBuild(COMPILED + COMPILED)).toThrow(/found 2/)
  })

  it('refuses to re-stamp an already-stamped build', () => {
    expect(() => stampPublishBuild(stampPublishBuild(COMPILED))).toThrow(/found 0/)
  })
})

// The tests above run against COMPILED, a hand-written stand-in. That leaves the
// SENTINEL free to drift away from what tsc actually emits for sdk-version.ts —
// and the first thing to notice would be `pnpm changeset publish` throwing
// mid-release, after packages/core may already be on npm. These tests compile
// the real source the way `expo-module build` does and assert the anchor
// survives, so drift fails a PR instead of a publish.
describe('stampPublishBuild against real tsc output', () => {
  function transpileSource(): string {
    const source = fs.readFileSync(path.join(__dirname, '..', 'sdk-version.ts'), 'utf8')
    return ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    }).outputText
  }

  it('emits exactly one anchor from src/lib/sdk-version.ts', () => {
    expect(transpileSource().split(SENTINEL).length - 1).toBe(1)
  })

  it('stamps the real compiled output', () => {
    const out = stampPublishBuild(transpileSource())
    expect(out).toContain(STAMPED)
    expect(out).not.toContain(SENTINEL)
  })

  // The reason the guard asserts the positive stamp instead of matching `-dev`:
  // the suffix survives in the dead else branch even in a published build, so a
  // `-dev` check would false-positive on every artifact.
  it('leaves -dev in the dead else branch after stamping, so -dev is not a usable signal', () => {
    expect(stampPublishBuild(transpileSource())).toContain('-dev')
  })
})
