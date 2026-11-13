import { screen } from '@testing-library/react-native'
import { StyleSheet, type TextStyle } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

/** Walk ancestors until `key` is set on a flattened style; return that style. */
export function nearestStyle(text: string, key: keyof TextStyle): TextStyle | undefined {
  let node: ReactTestInstance | null = screen.getByText(text)
  while (node !== null) {
    const flat: TextStyle | undefined = StyleSheet.flatten(node.props.style)
    if (flat?.[key] !== undefined) {
      return flat
    }
    node = node.parent
  }
  return undefined
}
