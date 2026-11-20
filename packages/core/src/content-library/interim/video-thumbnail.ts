// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.

import type { ContentLibraryVideo, VideoThumbnailSize } from './video-schemas'

/**
 * YPE-6538: thumbnail URLs are whatever the deployment returns. This only
 * selects a rendition. It does not add an app key.
 */
export function resolveVideoThumbnail(
  video: ContentLibraryVideo,
  size?: VideoThumbnailSize,
): ContentLibraryVideo {
  if (video.thumbnail?.url == null) {
    return video
  }
  const resolvedUrl = withThumbnailSize(video.thumbnail.url, size)
  if (resolvedUrl === video.thumbnail.url) {
    return video
  }
  return { ...video, thumbnail: { ...video.thumbnail, url: resolvedUrl } }
}

function withThumbnailSize(url: string, size?: VideoThumbnailSize): string {
  const fragmentIndex = url.indexOf('#')
  let fragment = ''
  let beforeFragment = url
  if (fragmentIndex !== -1) {
    fragment = url.slice(fragmentIndex)
    beforeFragment = url.slice(0, fragmentIndex)
  }
  const queryIndex = beforeFragment.indexOf('?')
  let resource = beforeFragment
  let rawQuery = ''
  if (queryIndex !== -1) {
    resource = beforeFragment.slice(0, queryIndex)
    rawQuery = beforeFragment.slice(queryIndex + 1)
  }
  let parameters: string[] = []
  if (rawQuery !== '') {
    parameters = rawQuery.split('&')
  }
  if (size === undefined && !parameters.some(isSizeParameter)) {
    return url
  }
  const keptParameters = parameters.filter((parameter) => !isSizeParameter(parameter))
  if (size !== undefined) {
    keptParameters.push(`size=${size}`)
  }
  if (keptParameters.length === 0) {
    return `${resource}${fragment}`
  }
  return `${resource}?${keptParameters.join('&')}${fragment}`
}

function isSizeParameter(parameter: string): boolean {
  const equalsIndex = parameter.indexOf('=')
  const encodedName = equalsIndex === -1 ? parameter : parameter.slice(0, equalsIndex)
  try {
    return decodeURIComponent(encodedName.replaceAll('+', ' ')) === 'size'
  } catch {
    return false
  }
}
