import type { ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'

import type { ListedCollection } from './playlist-videos'

const collections = new Map<string, ListedCollection>()
const videos = new Map<string, ContentLibraryVideo>()

export function rememberCollection(collection: ListedCollection): void {
  collections.set(collection.id, collection)
}

export function openedCollection(id: string): ListedCollection | undefined {
  return collections.get(id)
}

export function rememberPlaylistVideo(requestedId: string, video: ContentLibraryVideo): void {
  videos.set(requestedId, video)
}

export function openedPlaylistVideo(requestedId: string): ContentLibraryVideo | undefined {
  return videos.get(requestedId)
}
