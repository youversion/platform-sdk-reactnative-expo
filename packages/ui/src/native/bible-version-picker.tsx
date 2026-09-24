import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { VersionPickerContent } from '../components/bible/version-picker-content'
import { useVersionPicker } from '../components/bible/use-version-picker'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { getImpl, registerDefault } from './component-impls'

export type BibleVersionPickerProps = {
  versionId?: number
  languageId?: string
  sheetOpenedNonce?: number
  onSelect?: (versionId: number) => void | Promise<void>
  style?: StyleProp<ViewStyle>
}

function BibleVersionPickerImpl({
  versionId = DEFAULT_BIBLE_VERSION_ID,
  languageId,
  sheetOpenedNonce = 0,
  onSelect,
  style,
}: BibleVersionPickerProps): ReactNode {
  const controller = useVersionPicker({
    versionId,
    selectedLanguageId: languageId,
    sheetOpenedNonce,
    onSelect,
  })

  return <VersionPickerContent controller={controller} style={style} />
}

registerDefault('BibleVersionPicker', BibleVersionPickerImpl)

export function BibleVersionPicker(props: BibleVersionPickerProps): ReactNode {
  const Impl = getImpl('BibleVersionPicker')
  return <Impl {...props} />
}
