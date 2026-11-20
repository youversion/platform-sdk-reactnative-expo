import type { AuthContextValue } from './auth/auth-context'
import type { UseHighlightPermissionFlowResult } from './highlights/use-highlight-permission-flow'
import type { UseHighlightsOptions, UseHighlightsResult } from './highlights/use-highlights'
import type { UseImagesResult } from './images/use-images'
import type { UsePlaylistsResult } from './playlists/use-playlists'
import type { UseSearchResult } from './search/use-search'
import type { UseVerseOfTheDayResult } from './verse-of-the-day/use-verse-of-the-day'
import type { UseVideosResult } from './videos/use-videos'
import type {
  UseUnifiedSearchOptions,
  UseUnifiedSearchProps,
  UseUnifiedSearchResult,
} from './search/use-unified-search'

/**
 * Test seam: skip live fetch and return stub hook results.
 * Production providers leave this unset.
 *
 * Override wrappers still call the real hook (rules of hooks) but pass
 * `live: false` so it does not GET, write, notify the drain, or persist cache.
 */
export type HookOverrides = {
  useYVAuth?: AuthContextValue | null
  useHighlights?: (options: UseHighlightsOptions) => UseHighlightsResult
  useHighlightPermissionFlow?: (options: UseHighlightsOptions) => UseHighlightPermissionFlowResult
  useSearch?: () => UseSearchResult
  useUnifiedSearch?: (
    props: UseUnifiedSearchProps,
    options?: UseUnifiedSearchOptions,
  ) => UseUnifiedSearchResult
  useImages?: () => UseImagesResult
  useVideos?: () => UseVideosResult
  usePlaylists?: () => UsePlaylistsResult
  useVerseOfTheDay?: () => UseVerseOfTheDayResult
}
