import type { ReactElement, ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

export type BackdropRenderProps = {
  animatedIndex: { value: number }
}

export type BackdropElement = ReactElement<{ onPress?: () => void }>

export type CapturedBottomSheetProps = {
  backdropComponent?: (props: BackdropRenderProps) => BackdropElement | null
  onAnimate?: (fromIndex: number, toIndex: number) => void
  style?: StyleProp<ViewStyle>
  detached?: boolean
  bottomInset?: number
  containerStyle?: ViewStyle
  handleComponent?: ReactNode
  backgroundComponent?: ReactNode
  enablePanDownToClose?: boolean
  enableHandlePanningGesture?: boolean
  enableContentPanningGesture?: boolean
  accessible?: boolean
  accessibilityElementsHidden?: boolean
  importantForAccessibility?: string
  backgroundStyle?: ViewStyle
  handleIndicatorStyle?: ViewStyle | ViewStyle[]
  activeOffsetY?: [number, number]
}

export const latestBottomSheetProps: CapturedBottomSheetProps

export function resetLatestBottomSheetProps(): void

export function createGorhomMock(): {
  __esModule: true
  default: unknown
  BottomSheetBackdrop: unknown
  BottomSheetView: unknown
}
