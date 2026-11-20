import { Share } from 'react-native'

/** Share the image URL with the platform sheet. Dismissing the sheet is not an error. */
export async function shareImageUrl(url: string): Promise<void> {
  try {
    await Share.share({ message: url, url })
  } catch {
    return
  }
}
