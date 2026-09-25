import { mmkvStorage } from '@youversion/platform-react-native-expo-core'

import { RECENT_BIBLE_VERSIONS_PERSIST_KEY } from '../../lib/constants'
import {
  recentBibleVersionsStoreInitialState,
  useRecentBibleVersionsStore,
} from '../recent-bible-versions-store'

async function resetRecentBibleVersionsStore() {
  mmkvStorage.remove(RECENT_BIBLE_VERSIONS_PERSIST_KEY)
  useRecentBibleVersionsStore.setState(recentBibleVersionsStoreInitialState)
  await useRecentBibleVersionsStore.persist.rehydrate()
}

describe('recent-bible-versions-store', () => {
  beforeEach(async () => {
    await resetRecentBibleVersionsStore()
  })

  it('moves a selected version to the front and caps the list', () => {
    useRecentBibleVersionsStore.getState().recordVersionSelection(1)
    useRecentBibleVersionsStore.getState().recordVersionSelection(2)
    useRecentBibleVersionsStore.getState().recordVersionSelection(3)
    useRecentBibleVersionsStore.getState().recordVersionSelection(4)
    useRecentBibleVersionsStore.getState().recordVersionSelection(2)

    expect(useRecentBibleVersionsStore.getState().versionIds).toEqual([2, 4, 3])
  })

  it('rehydrates the same ordered list on a relaunch read', async () => {
    mmkvStorage.set(
      RECENT_BIBLE_VERSIONS_PERSIST_KEY,
      JSON.stringify({
        state: { versionIds: [3034, 59] },
        version: 0,
      }),
    )

    await useRecentBibleVersionsStore.persist.rehydrate()

    expect(useRecentBibleVersionsStore.getState().versionIds).toEqual([3034, 59])
  })
})
