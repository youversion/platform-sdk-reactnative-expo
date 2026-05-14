import { BibleCard } from '@youversion/platform-react-native-expo'

import { WidgetPreviewWrapper } from '../_components/widget-preview-wrapper'

export default function BibleCardScreen() {
  return (
    <WidgetPreviewWrapper title="BibleCard">
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ matchContents: true }} />
    </WidgetPreviewWrapper>
  )
}
