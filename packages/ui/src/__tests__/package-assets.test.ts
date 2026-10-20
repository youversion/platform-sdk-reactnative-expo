import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import packageJson from '../../package.json'

const WORDMARKS = [
  'assets/bible-app-wordmark-black-text.png',
  'assets/bible-app-wordmark-white-text.png',
]

const PACKAGE_ROOT = resolve(__dirname, '../..')
const SRC = join(PACKAGE_ROOT, 'src')
const IMAGE_SPECIFIER =
  /(?:require\(\s*|from\s+|import\s+)['"]([^'"]+\.(?:png|jpe?g|gif|webp))['"]/g

function sourceFiles(dir: string): string[] {
  const found: string[] = []

  function walk(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'test-utils') continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        found.push(path)
      }
    }
  }

  walk(dir)
  found.sort()
  return found
}

function requiredImages(file: string): { fromSrc: string; fromBuild: string }[] {
  const source = readFileSync(file, 'utf8')
  const images: { fromSrc: string; fromBuild: string }[] = []
  const buildFile = join(PACKAGE_ROOT, 'build', relative(SRC, file))
  for (const match of source.matchAll(IMAGE_SPECIFIER)) {
    const specifier = match[1]
    if (specifier == null) continue
    images.push({
      fromSrc: packageRelative(file, specifier),
      fromBuild: packageRelative(buildFile, specifier),
    })
  }
  return images
}

function packageRelative(fromFile: string, specifier: string): string {
  const absolute = resolve(dirname(fromFile), specifier)
  return relative(PACKAGE_ROOT, absolute).split(sep).join(posix.sep)
}

function topLevelDir(packagePath: string): string {
  const normalized = packagePath.split(sep).join(posix.sep)
  const [segment, ...rest] = normalized.split(posix.sep)
  if (segment == null || segment.length === 0 || rest.length === 0) {
    throw new Error(`image path has no directory: ${packagePath}`)
  }
  return segment
}

describe('package assets', () => {
  it('ships every image a source file requires', () => {
    const rows = sourceFiles(SRC).flatMap(requiredImages)
    const images = rows.map((row) => row.fromSrc)

    expect(images).toEqual(expect.arrayContaining(WORDMARKS))
    for (const row of rows) {
      expect(row.fromBuild).toBe(row.fromSrc)
      expect(packageJson.files).toContain(topLevelDir(row.fromSrc))
    }
  })
})
