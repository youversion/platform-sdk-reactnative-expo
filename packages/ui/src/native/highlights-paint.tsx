import {
  useHighlightPaint,
  type Highlight,
  type HighlightScope,
} from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'

type HighlightsPaintProps = {
  scope: HighlightScope | null
  children: (highlights: Highlight[]) => ReactNode
}

/**
 * Paint-only Cached Highlights for a Highlight Scope.
 *
 * `useHighlightPaint` (and through it `useHighlights`) runs in this same
 * component, so the first `children(highlights)` call already has the hook's
 * first-render cache snapshot. Always calling `children` from this instance
 * means resolving a VOTD passage_id (scope null → a real Highlight Scope) does
 * not remount the WebView.
 */
export function HighlightsPaint({ scope, children }: HighlightsPaintProps): ReactNode {
  const highlights = useHighlightPaint(scope)
  return children(highlights)
}
