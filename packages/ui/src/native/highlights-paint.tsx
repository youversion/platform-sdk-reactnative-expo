import {
  useHighlights,
  type Highlight,
  type HighlightScope,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type HighlightsPaintProps = {
  scope: HighlightScope | null
  children: (highlights: Highlight[]) => ReactNode
}

function sameHighlights(left: Highlight[], right: Highlight[]): boolean {
  if (left === right) {
    return true
  }
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index++) {
    const a = left[index]
    const b = right[index]
    if (
      a === undefined ||
      b === undefined ||
      a.version_id !== b.version_id ||
      a.passage_id !== b.passage_id ||
      a.color !== b.color
    ) {
      return false
    }
  }
  return true
}

/**
 * Paint-only Cached Highlights for a Highlight Scope.
 *
 * Yields `[]` when there is no scope (invalid USFM, VOTD still loading) so the
 * Expo DOM Component can latch Controlled Highlights Latch on first mount.
 * The subscription is a sibling, not a wrapper, so resolving a VOTD passage_id
 * does not remount the WebView.
 */
export function HighlightsPaint({ scope, children }: HighlightsPaintProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const scopeKey = scope === null ? '' : `${scope.versionId}:${scope.book}:${scope.chapter}`
  const scopeKeyRef = useRef(scopeKey)

  if (scopeKeyRef.current !== scopeKey) {
    scopeKeyRef.current = scopeKey
    if (highlights.length > 0) {
      setHighlights([])
    }
  }

  const onHighlights = useCallback((next: Highlight[]) => {
    setHighlights((current) => (sameHighlights(current, next) ? current : next))
  }, [])

  return (
    <>
      {scope !== null ? (
        <HighlightsSubscription key={scopeKey} scope={scope} onHighlights={onHighlights} />
      ) : null}
      {children(scope === null ? [] : highlights)}
    </>
  )
}

function HighlightsSubscription({
  scope,
  onHighlights,
}: {
  scope: HighlightScope
  onHighlights: (highlights: Highlight[]) => void
}) {
  const { highlights } = useHighlights(scope)

  useEffect(() => {
    onHighlights(highlights ?? [])
  }, [highlights, onHighlights])

  return null
}
