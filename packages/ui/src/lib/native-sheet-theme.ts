import type { Theme } from './resolve-theme'

/**
 * Colors for the native bottom-sheet chrome rendered by @gorhom/bottom-sheet
 * (background surface behind the handle and rounded corners, plus the drag
 * handle indicator). These live in native land, so they cannot inherit the
 * Web SDK theme the DOM content uses — they must be themed explicitly.
 */

/** Background surface behind the sheet chrome (handle area, rounded top corners). */
export const SHEET_SURFACE: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#1f1d1d',
}

/** Drag-handle indicator color. */
export const SHEET_HANDLE: Record<Theme, string> = {
  light: '#cccccc',
  dark: '#5a5757',
}

/** Muted panel background used inside the version/chapter picker sheet content. */
export const SHEET_MUTED_BACKGROUND: Record<Theme, string> = {
  light: '#f6f4f4',
  dark: '#353333',
}
