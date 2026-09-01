import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// File IO in the script is guarded by `require.main === module`; requiring it
// here only loads the pure transform.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stampPublishBuild, SENTINEL, STAMPED } = require('../../scripts/stamp-sdk-version.cjs')

// Stand-in for the compiled build/sdk-version.js.
const COMPILED = [
  "import pkg from '../package.json';",
  'const IS_PUBLISH_BUILD = false;',
  'export const SDK_VERSION = IS_PUBLISH_BUILD ? pkg.version : `${pkg.version}-dev`;',
  "const SDK_HEADER_NAME = 'X-YVP-Sdk';",
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
    expect(out).toContain("const SDK_HEADER_NAME = 'X-YVP-Sdk';")
    expect(out).toContain("import pkg from '../package.json';")
  })

  it('throws if the anchor is missing (fails closed, never ships -dev)', () => {
    expect(() => stampPublishBuild('export const SDK_VERSION = pkg.version;')).toThrow(/found 0/)
  })

  it('throws if the anchor appears more than once', () => {
    expect(() => stampPublishBuild(COMPILED + COMPILED)).toThrow(/found 2/)
  })

  it('refuses to re-stamp an already-stamped build', () => {
    expect(() => stampPublishBuild(stampPublishBuild(COMPILED))).toThrow(/found 0/)
  })
})

// SENTINEL matches compiled text, so it can drift from what tsc emits with the
// fixture tests still green. Compile the real source and catch drift in the PR
// instead of mid-publish.
describe('stampPublishBuild against real tsc output', () => {
  function transpileSource(): string {
    const sourcePath = path.join(__dirname, '..', 'sdk-version.ts')
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-stamp-'))
    execFileSync(
      path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc'),
      [
        sourcePath,
        '--ignoreConfig',
        '--target',
        'ESNext',
        '--module',
        'ESNext',
        '--outDir',
        outDir,
        '--skipLibCheck',
        '--declaration',
        'false',
      ],
      { encoding: 'utf8' },
    )
    return fs.readFileSync(path.join(outDir, 'src/sdk-version.js'), 'utf8')
  }

  it('emits exactly one anchor from src/sdk-version.ts', () => {
    expect(transpileSource().split(SENTINEL).length - 1).toBe(1)
  })

  it('stamps the real compiled output', () => {
    const out = stampPublishBuild(transpileSource())
    expect(out).toContain(STAMPED)
    expect(out).not.toContain(SENTINEL)
  })

  it('leaves -dev in the dead else branch after stamping, so -dev is not a usable signal', () => {
    expect(stampPublishBuild(transpileSource())).toContain('-dev')
  })
})
