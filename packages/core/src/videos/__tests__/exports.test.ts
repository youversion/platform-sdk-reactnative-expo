import * as core from '../../index'

describe('video package exports', () => {
  it('exposes the video and playlist hooks', () => {
    expect(core.useVideos).toEqual(expect.any(Function))
    expect(core.usePlaylists).toEqual(expect.any(Function))
  })

  it('keeps the interim client and the factory internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('VideosClient')
    expect(names).not.toContain('createVideosApi')
    expect(names).not.toContain('createPlaylistsApi')
    expect(names).not.toContain('searchVideos')
    expect(names).not.toContain('searchUnified')
  })
})
