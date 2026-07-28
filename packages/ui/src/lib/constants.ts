/** Zustand `persist` name / MMKV key for reader font settings blob. */
export const READER_SETTINGS_PERSIST_KEY = 'yv-reader:settings'

/** Zustand `persist` name / MMKV key for persisted Reader Location blob. */
export const READER_LOCATION_PERSIST_KEY = 'yv-reader:location'

/** Zustand `persist` name / MMKV key for persisted Bible Card version blob. */
export const BIBLE_CARD_VERSION_PERSIST_KEY = 'yv-bible-card:version'

/** YouVersion default Bible version: 3034 = Berean Standard Bible (BSB). Find other IDs at https://platform.youversion.com. */
export const DEFAULT_BIBLE_VERSION_ID = 3034

/**
 * The permission a highlight write needs. Travels in `requested_permissions[]`,
 * never in `scope` — passing it as a scope grants nothing, because the auth
 * server silently drops unknown scope values.
 */
export const HIGHLIGHTS_PERMISSION = 'highlights'
