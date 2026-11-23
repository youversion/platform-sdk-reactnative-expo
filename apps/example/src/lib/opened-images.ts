import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'

const opened = new Map<string, YouVersionImage>()

export function rememberOpenedImage(image: YouVersionImage): void {
  opened.set(image.id, image)
}

export function openedImage(id: string): YouVersionImage | undefined {
  return opened.get(id)
}
