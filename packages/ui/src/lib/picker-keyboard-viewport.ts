export type PickerViewportMetrics = {
  overlap: number
  visibleHeight: number
  offsetTop: number
}

export function getPickerViewportMetrics(
  innerHeight: number,
  viewport: Pick<VisualViewport, 'height' | 'offsetTop'>,
): PickerViewportMetrics {
  const offsetTop = viewport.offsetTop
  const visibleHeight = viewport.height
  const overlap = Math.max(0, innerHeight - visibleHeight - offsetTop)

  return { overlap, visibleHeight, offsetTop }
}

export function getPickerViewportCssProperties(
  metrics: PickerViewportMetrics,
): Record<string, string> {
  return {
    '--yv-visible-height': `${metrics.visibleHeight}px`,
    '--yv-viewport-offset-top': `${metrics.offsetTop}px`,
  }
}

// Android reports visualViewport.height as 0 (or a few px mid-animation) while
// the WebView sits in an offscreen inert sheet host (ADR 0006). Writing that
// value would collapse the picker shell to 0px, and the correcting resize event
// only fires after the sheet is already visible — a jarring layout jump on
// open. No real keyboard-shrunk viewport is ever this short, so heights below
// this floor mean "viewport metrics unavailable".
export const MIN_PICKER_VIEWPORT_HEIGHT = 50

export function isPickerViewportHidden(viewport: Pick<VisualViewport, 'height'>): boolean {
  return viewport.height < MIN_PICKER_VIEWPORT_HEIGHT
}

export function syncPickerKeyboardViewport(root: HTMLElement, viewport: VisualViewport): void {
  if (isPickerViewportHidden(viewport)) {
    // Fall back to the stylesheet defaults (100vh / 0px) so the pre-warmed
    // layout is already correct when the sheet opens; real metrics re-sync via
    // the resize listener once the WebView is visible.
    root.style.removeProperty('--yv-visible-height')
    root.style.removeProperty('--yv-viewport-offset-top')
    return
  }

  const metrics = getPickerViewportMetrics(window.innerHeight, viewport)
  const properties = getPickerViewportCssProperties(metrics)

  for (const [name, value] of Object.entries(properties)) {
    root.style.setProperty(name, value)
  }
}

/** Re-apply viewport CSS from the current visualViewport (e.g. after sheet re-open). */
export function resyncPickerKeyboardViewport(root: HTMLElement): void {
  const viewport = window.visualViewport
  if (!viewport) return
  syncPickerKeyboardViewport(root, viewport)
}

export function attachPickerKeyboardViewportListeners(root: HTMLElement): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}

  const update = () => syncPickerKeyboardViewport(root, viewport)

  update()
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update, { passive: true })

  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
  }
}
