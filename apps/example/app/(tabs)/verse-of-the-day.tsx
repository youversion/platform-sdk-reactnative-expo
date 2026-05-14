import { VerseOfTheDay } from '@youversion/platform-react-native-expo'

import { WidgetPreviewWrapper } from '../_components/widget-preview-wrapper'

export default function VerseOfTheDayScreen() {
  return (
    <WidgetPreviewWrapper title="VerseOfTheDay">
      <VerseOfTheDay versionId={3034} dom={{ matchContents: true }} />
    </WidgetPreviewWrapper>
  )
}
