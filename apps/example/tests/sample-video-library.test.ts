import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  SAMPLE_COLLECTION,
  SAMPLE_VIDEO,
  SAMPLE_VIDEO_ID,
  collectionsOrSample,
  sampleCollection,
  sampleVideo,
} from '../src/lib/sample-video-library.ts'
import { playbackSourceUrl } from '../src/lib/playlist-videos.ts'

describe('sample video library', () => {
  it('resolves the public demo clip and keeps real collections when present', () => {
    assert.equal(sampleVideo(SAMPLE_VIDEO_ID)?.title, 'Big Buck Bunny')
    assert.equal(sampleVideo('other'), null)
    assert.equal(sampleCollection(SAMPLE_COLLECTION.id)?.videoIds[0], SAMPLE_VIDEO_ID)
    assert.equal(sampleCollection('12'), null)
    assert.ok(playbackSourceUrl(SAMPLE_VIDEO.playback_sources)?.startsWith('https://'))
    assert.deepEqual(collectionsOrSample([]), [SAMPLE_COLLECTION])
    assert.deepEqual(collectionsOrSample([{ ...SAMPLE_COLLECTION, id: '9', title: 'Live' }]), [
      { ...SAMPLE_COLLECTION, id: '9', title: 'Live' },
    ])
  })
})
