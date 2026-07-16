import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

// The publish stamp lives in scripts/ as a single `.cjs` so Node can run it at
// publish time with no build step, while this test requires the same file and
// exercises the pure transform. The file-IO block is guarded by
// `require.main === module`, so requiring it here never touches the filesystem.
// See docs/adr/0012-sdk-version-stamp-on-publish.md.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stampSdkVersion, SENTINEL } = require('../../../scripts/stamp-sdk-version.cjs')

// Mirrors the shape of the compiled build/lib/sdk-version.js: preserved comments
// (which mention 'Dev' incidentally) plus the real assignment line.
const COMPILED = [
  "// STAMP anchor: the publish stamp replaces the 'Dev' value on the next line.",
  "export const SDK_VERSION = 'Dev';",
  "const SDK_HEADER_NAME = 'x-yvp-sdk';",
  '',
].join('\n')

describe('stampSdkVersion', () => {
  it('replaces the Dev sentinel with the real version', () => {
    const out = stampSdkVersion(COMPILED, '1.2.3')
    expect(out).toContain("SDK_VERSION = '1.2.3'")
    expect(out).not.toContain(SENTINEL)
  })

  it('leaves the surrounding lines untouched', () => {
    const out = stampSdkVersion(COMPILED, '1.2.3')
    expect(out).toContain("const SDK_HEADER_NAME = 'x-yvp-sdk';")
  })

  it('counts the anchor exactly, ignoring incidental "Dev" in comments', () => {
    // The comment line mentions 'Dev' but is not the full assignment, so there
    // is still exactly one anchor.
    expect(COMPILED).toContain("'Dev'")
    expect(COMPILED.split(SENTINEL).length - 1).toBe(1)
  })

  it('throws if the sentinel is missing (never silently ships Dev)', () => {
    expect(() => stampSdkVersion("export const SDK_VERSION = '9.9.9';", '1.2.3')).toThrow(/found 0/)
  })

  it('throws if the sentinel appears more than once', () => {
    expect(() => stampSdkVersion(COMPILED + COMPILED, '1.2.3')).toThrow(/found 2/)
  })

  it('rejects an empty version', () => {
    expect(() => stampSdkVersion(COMPILED, '   ')).toThrow(/non-empty/)
  })

  it('rejects an unsafe version that would break the string literal', () => {
    expect(() => stampSdkVersion(COMPILED, "1.0'; hack()//")).toThrow(/unsafe/)
  })

  it('handles prerelease versions', () => {
    const out = stampSdkVersion(COMPILED, '1.2.3-beta.1')
    expect(out).toContain("SDK_VERSION = '1.2.3-beta.1'")
  })
})

// The tests above run against COMPILED, a hand-written stand-in. That leaves the
// SENTINEL free to drift away from what tsc actually emits for sdk-version.ts —
// and the first thing to notice would be `pnpm changeset publish` throwing
// mid-release, after packages/core may already be on npm. These tests compile
// the real source the way `expo-module build` does and assert the anchor
// survives, so drift fails a PR instead of a publish.
describe('stampSdkVersion against real tsc output', () => {
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
    const out = stampSdkVersion(transpileSource(), '1.2.3')
    expect(out).toContain("SDK_VERSION = '1.2.3'")
    expect(out).not.toContain(SENTINEL)
  })
})
