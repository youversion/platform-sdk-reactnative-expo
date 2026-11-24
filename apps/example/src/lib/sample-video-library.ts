import type { ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'

import type { ListedCollection } from './playlist-videos'

/**
 * Local stand-in while the app key has no video catalog.
 * Big Buck Bunny (Creative Commons): Mux's public HLS test stream, Blender's poster.
 * Google's gtv-videos-bucket now returns 403, so do not go back to it.
 */
export const SAMPLE_VIDEO_ID = 'sample-big-buck-bunny'
export const SAMPLE_COLLECTION_ID = '0'

const SAMPLE_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
const SAMPLE_MP4 =
  'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4'
const SAMPLE_POSTER = 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg'

export const SAMPLE_VIDEO = {
  id: SAMPLE_VIDEO_ID,
  title: 'Big Buck Bunny',
  description:
    'Sample clip for the Content tab while Platform video APIs are unavailable for this app key.',
  language_tag: 'en',
  runtime: 596,
  orientation: 'landscape',
  passage_id: null,
  passage_ids: null,
  organization_id: null,
  references: null,
  share_url: 'https://peach.blender.org/',
  thumbnail: {
    url: SAMPLE_POSTER,
    width: 1920,
    height: 1080,
  },
  playback_sources: [
    { format: 'hls', url: SAMPLE_HLS },
    { format: 'mp4', url: SAMPLE_MP4 },
  ],
  playback_preview_sources: [],
} as const satisfies ContentLibraryVideo

export const SAMPLE_COLLECTION = {
  id: SAMPLE_COLLECTION_ID,
  playlistId: 0,
  title: 'Sample videos',
  description: 'Public demo media for local playback testing.',
  total: 1,
  videoIds: [SAMPLE_VIDEO_ID],
} as const satisfies ListedCollection

export function sampleVideo(id: string): ContentLibraryVideo | null {
  if (id === SAMPLE_VIDEO_ID) return SAMPLE_VIDEO
  return null
}

export function sampleCollection(id: string): ListedCollection | null {
  if (id === SAMPLE_COLLECTION_ID) return SAMPLE_COLLECTION
  return null
}

/** When the API returns no playlists, show the sample so the Content tab stays usable. */
export function collectionsOrSample(
  collections: readonly ListedCollection[],
): readonly ListedCollection[] {
  if (collections.length > 0) return collections
  return [SAMPLE_COLLECTION]
}
