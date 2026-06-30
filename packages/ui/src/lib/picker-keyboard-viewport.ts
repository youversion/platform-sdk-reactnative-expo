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

export function syncPickerKeyboardViewport(root: HTMLElement, viewport: VisualViewport): void {
  const metrics = getPickerViewportMetrics(window.innerHeight, viewport)
  const properties = getPickerViewportCssProperties(metrics)

  for (const [name, value] of Object.entries(properties)) {
    root.style.setProperty(name, value)
  }
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
