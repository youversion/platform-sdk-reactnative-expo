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
    // is still exactly one anchor and the stamp succeeds.
    expect(() => stampSdkVersion(COMPILED, '1.2.3')).not.toThrow()
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
