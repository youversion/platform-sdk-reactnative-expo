import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { VersionPickerContent } from '../components/bible/version-picker-content'
import { useVersionPicker } from '../components/bible/use-version-picker'
import { DEFAULT_BIBLE_VERSION_ID } from '../lib/constants'
import { getImpl, registerDefault } from './component-impls'

export type BibleVersionPickerProps = {
  versionId?: number
  languageId?: string
  onSelect?: (versionId: number) => void | Promise<void>
  onClose?: () => void
  style?: StyleProp<ViewStyle>
}

function BibleVersionPickerImpl({
  versionId = DEFAULT_BIBLE_VERSION_ID,
  languageId,
  onSelect,
  onClose,
  style,
}: BibleVersionPickerProps): ReactNode {
  const controller = useVersionPicker({
    versionId,
    selectedLanguageId: languageId,
    onSelect,
  })

  return <VersionPickerContent controller={controller} style={style} onClose={onClose} />
}

registerDefault('BibleVersionPicker', BibleVersionPickerImpl)

export function BibleVersionPicker(props: BibleVersionPickerProps): ReactNode {
  const Impl = getImpl('BibleVersionPicker')
  return <Impl {...props} />
}
