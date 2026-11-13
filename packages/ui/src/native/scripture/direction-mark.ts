import { Platform } from 'react-native'

const LEFT_TO_RIGHT_MARK = '‎'
const RIGHT_TO_LEFT_MARK = '‏'
const DIRECTION_MARKS = /[‎‏]/g

// RN Android ignores writingDirection and lays text out by its first strong letter, so
// a paragraph opening in the other script flips. An invisible mark is that first letter.
export function directionMark(rtl: boolean, platform: string = Platform.OS): string {
  if (platform !== 'android') {
    return ''
  }
  return rtl ? RIGHT_TO_LEFT_MARK : LEFT_TO_RIGHT_MARK
}

/** Drop API U+200E / U+200F so an RTL heading is not scrambled by a leftover mark. */
export function stripDirectionMarks(text: string): string {
  return text.replace(DIRECTION_MARKS, '')
}
