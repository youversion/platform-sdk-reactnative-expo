import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const useFontsSource = readFileSync(join(__dirname, '../use-fonts.ts'), 'utf8')

describe('use-fonts font package imports', () => {
  it('imports Inter and Source Serif faces by subpath only', () => {
    expect(useFontsSource).not.toMatch(/from '@expo-google-fonts\/inter'/)
    expect(useFontsSource).not.toMatch(/from '@expo-google-fonts\/source-serif-4'/)

    expect(useFontsSource).toContain("from '@expo-google-fonts/inter/400Regular'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/inter/500Medium'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/inter/700Bold'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/400Regular'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/400Regular_Italic'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/500Medium'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/500Medium_Italic'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/700Bold'")
    expect(useFontsSource).toContain("from '@expo-google-fonts/source-serif-4/700Bold_Italic'")
  })
})
