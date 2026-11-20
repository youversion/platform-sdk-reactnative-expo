export type Identified = {
  readonly id: string
}

export type CardList<T extends Identified> = {
  readonly items: readonly T[]
  readonly nextPageToken: string | null
  readonly selectedId: string | null
}

export type LibraryEvent<T extends Identified> =
  | { type: 'replace'; page: readonly T[]; nextPageToken: string | null }
  | { type: 'append'; page: readonly T[]; nextPageToken: string | null }
  | { type: 'failure' }

export function emptyCardList<T extends Identified>(): CardList<T> {
  return { items: [], nextPageToken: null, selectedId: null }
}

/** Keep the first copy of each id. Later copies are dropped and earlier cards stay put. */
export function dedupeAppend<T extends Identified>(
  existing: readonly T[],
  incoming: readonly T[],
): readonly T[] {
  const seen = new Set(existing.map((item) => item.id))
  const next = existing.slice()
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    next.push(item)
  }
  return next
}

export function appendUniqueIds(
  existing: readonly string[],
  incoming: readonly string[],
): readonly string[] {
  const seen = new Set(existing)
  const next = existing.slice()
  for (const id of incoming) {
    if (seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next
}

/** A selected card that is still in the list stays selected. Otherwise the first card is selected. */
export function selectionFor(
  items: readonly Identified[],
  selectedId: string | null,
): string | null {
  if (items.length === 0) return null
  if (selectedId !== null && items.some((item) => item.id === selectedId)) return selectedId
  const first = items[0]
  return first === undefined ? null : first.id
}

/**
 * A later page that fails leaves the list alone, including its selection and page token.
 * A successful page either replaces the list or appends unseen cards without reordering.
 */
export function reduceLibrary<T extends Identified>(
  current: CardList<T>,
  event: LibraryEvent<T>,
): CardList<T> {
  if (event.type === 'failure') return current
  const items =
    event.type === 'replace'
      ? dedupeAppend([], event.page)
      : dedupeAppend(current.items, event.page)
  return {
    items,
    nextPageToken: event.nextPageToken,
    selectedId: selectionFor(items, current.selectedId),
  }
}

/** Drop a result that belongs to an older search or an older screen. */
export function acceptIfCurrent<T>(
  requestGeneration: number,
  currentGeneration: number,
  value: T,
): T | null {
  if (requestGeneration !== currentGeneration) return null
  return value
}

/** Search hits are only ids. Resolved records are shown in the order the server sent. */
export function imagesInServerOrder<T extends Identified>(
  orderedIds: readonly string[],
  resolved: ReadonlyMap<string, T>,
): readonly T[] {
  const items: T[] = []
  const seen = new Set<string>()
  for (const id of orderedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const image = resolved.get(id)
    if (image === undefined) continue
    items.push(image)
  }
  return items
}

export function unresolvedIds(
  orderedIds: readonly string[],
  resolved: ReadonlyMap<string, Identified>,
): readonly string[] {
  const pending: string[] = []
  const seen = new Set<string>()
  for (const id of orderedIds) {
    if (seen.has(id) || resolved.has(id)) continue
    seen.add(id)
    pending.push(id)
  }
  return pending
}

export function renditionUrl(imageUrl: string, size: 'thumb' | 'card' | 'full'): string {
  try {
    const url = new URL(imageUrl)
    url.searchParams.set('size', size)
    return url.toString()
  } catch {
    return imageUrl
  }
}

export function imageAspect(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1
  return ratio
}
