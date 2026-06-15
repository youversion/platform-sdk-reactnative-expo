'use dom'

import { BibleThemeSettingsContent } from '@youversion/platform-react-ui'

import type { FontFamily, FontFamilyToken } from '../lib/reader-fonts'
import { decodeFontFamilyFromDom } from '../lib/reader-fonts'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type BibleReaderSettingsDOMProps = {
  appKey: string
  theme: 'light' | 'dark'
  fontSize: number
  // Crosses the bridge as a token, not the canonical CSS stack — see reader-fonts.ts.
  fontFamily: FontFamilyToken
  lineSpacing: number
  // Expo DOM function props always cross the native <-> WebView bridge, so they must be async.
  onFontIncreased: () => void
  onFontDecreased: () => void
  onFontSelected: (fontFamily: FontFamily) => void
  onLineSpacingChange: () => void
  dom?: import('expo/dom').DOMProps
}

export default function BibleReaderSettingsDOM({
  appKey,
  theme,
  fontSize,
  fontFamily,
  lineSpacing,
  onFontIncreased,
  onFontDecreased,
  onFontSelected,
  onLineSpacingChange,
}: BibleReaderSettingsDOMProps) {
  // React invokes button onClick handlers with a SyntheticEvent. That event
  // isn't JSON-serializable, so passing the bridge-bound handlers straight
  // through would crash the DOM <-> native bridge. These wrappers swallow the
  // event and forward only serializable args.
  const handleFontIncreased = () => {
    void onFontIncreased()
  }
  const handleFontDecreased = () => {
    void onFontDecreased()
  }
  const handleFontSelected = (family: FontFamily) => {
    void onFontSelected(family)
  }
  const handleLineSpacingChange = () => {
    void onLineSpacingChange()
  }

  // fontFamily crosses the bridge as a quote-free token; resolve it back to the
  // canonical CSS stack so the Web SDK highlights the active font. See
  // lib/reader-fonts.ts.
  const resolvedFontFamily = decodeFontFamilyFromDom(fontFamily)

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <style>{settingsStyles}</style>
      <div data-yv-sdk data-yv-theme={theme} data-yv-settings-shell>
        <BibleThemeSettingsContent
          theme={theme}
          fontSize={fontSize}
          fontFamily={resolvedFontFamily}
          lineSpacing={lineSpacing}
          onFontIncreased={handleFontIncreased}
          onFontDecreased={handleFontDecreased}
          onFontSelected={handleFontSelected}
          onChangeLineSpacing={handleLineSpacingChange}
        />
      </div>
    </YouVersionProvider>
  )
}

const settingsStyles = `
[data-yv-settings-shell] {
  width: 100%;
  color: var(--yv-foreground);
}
`

