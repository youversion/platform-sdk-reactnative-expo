/** Zustand `persist` name / MMKV key for reader font settings blob. */
export const READER_SETTINGS_PERSIST_KEY = 'yv-reader:settings'

/** Zustand `persist` name / MMKV key for persisted Reader Location blob. */
export const READER_LOCATION_PERSIST_KEY = 'yv-reader:location'

/** Zustand `persist` name / MMKV key for persisted Bible Card version blob. */
export const BIBLE_CARD_VERSION_PERSIST_KEY = 'yv-bible-card:version'

/** Zustand `persist` name / MMKV key for persisted Reader Search history blob. */
export const SEARCH_HISTORY_PERSIST_KEY = 'yv-reader:search-history'

/** The store keeps 8 on disk and the sheet shows the first 3. */
export const SEARCH_HISTORY_MAX = 8
/** Zustand `persist` name / MMKV key for recent Bible version picker ids. */
export const RECENT_BIBLE_VERSIONS_PERSIST_KEY = 'yv-version-picker:recent-versions'

/** Matches `@youversion/platform-react-ui` `MAX_RECENT_VERSIONS`. */
export const MAX_RECENT_BIBLE_VERSIONS = 3

/** YouVersion default Bible version: 3034 = Berean Standard Bible (BSB). Find other IDs at https://platform.youversion.com. */
export const DEFAULT_BIBLE_VERSION_ID = 3034
