import {
  attachPickerKeyboardViewportListeners,
  getPickerViewportCssProperties,
  getPickerViewportMetrics,
  isPickerViewportHidden,
} from '../picker-keyboard-viewport'

function createMockRoot() {
  const styles = new Map<string, string>()

  return {
    style: {
      setProperty(name: string, value: string) {
        styles.set(name, value)
      },
      removeProperty(name: string) {
        styles.delete(name)
      },
      getPropertyValue(name: string) {
        return styles.get(name) ?? ''
      },
    },
  } as HTMLElement
}

function createMockVisualViewport(initial: { height: number; offsetTop: number }) {
  let height = initial.height
  let offsetTop = initial.offsetTop
  const listeners = new Map<string, Set<() => void>>()

  return {
    get height() {
      return height
    },
    get offsetTop() {
      return offsetTop
    },
    setMetrics(next: { height: number; offsetTop: number }) {
      height = next.height
      offsetTop = next.offsetTop
    },
    addEventListener: jest.fn((type: string, handler: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(handler)
    }),
    removeEventListener: jest.fn((type: string, handler: () => void) => {
      listeners.get(type)?.delete(handler)
    }),
    dispatch(type: string) {
      for (const handler of listeners.get(type) ?? []) handler()
    },
  }
}

describe('getPickerViewportMetrics', () => {
  it('returns zero overlap when keyboard is closed', () => {
    const metrics = getPickerViewportMetrics(800, { height: 800, offsetTop: 0 })

    expect(metrics).toEqual({
      overlap: 0,
      visibleHeight: 800,
      offsetTop: 0,
    })
  })

  it('returns overlap and reduced visible height when keyboard is open', () => {
    const metrics = getPickerViewportMetrics(800, { height: 400, offsetTop: 0 })

    expect(metrics).toEqual({
      overlap: 400,
      visibleHeight: 400,
      offsetTop: 0,
    })
  })

  it('accounts for visual viewport offsetTop on iOS', () => {
    const metrics = getPickerViewportMetrics(800, { height: 400, offsetTop: 50 })

    expect(metrics).toEqual({
      overlap: 350,
      visibleHeight: 400,
      offsetTop: 50,
    })
  })

  it('never returns negative overlap', () => {
    const metrics = getPickerViewportMetrics(800, { height: 900, offsetTop: 0 })

    expect(metrics.overlap).toBe(0)
    expect(metrics.visibleHeight).toBe(900)
  })
})

describe('getPickerViewportCssProperties', () => {
  it('maps metrics to CSS custom property values', () => {
    expect(
      getPickerViewportCssProperties({
        overlap: 350,
        visibleHeight: 400,
        offsetTop: 50,
      }),
    ).toEqual({
      '--yv-visible-height': '400px',
      '--yv-viewport-offset-top': '50px',
    })
  })
})

describe('isPickerViewportHidden', () => {
  it('treats the Android offscreen-WebView heights as hidden', () => {
    expect(isPickerViewportHidden({ height: 0 })).toBe(true)
    expect(isPickerViewportHidden({ height: 4 })).toBe(true)
  })

  it('treats a keyboard-shrunk viewport as visible', () => {
    expect(isPickerViewportHidden({ height: 300 })).toBe(false)
    expect(isPickerViewportHidden({ height: 800 })).toBe(false)
  })
})

describe('attachPickerKeyboardViewportListeners', () => {
  const originalVisualViewport = window.visualViewport
  const originalInnerHeight = window.innerHeight

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalVisualViewport,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    })
  })

  it('syncs CSS properties on attach and on viewport resize', () => {
    const root = createMockRoot()
    const viewport = createMockVisualViewport({ height: 800, offsetTop: 0 })

    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    const cleanup = attachPickerKeyboardViewportListeners(root)

    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('800px')
    expect(root.style.getPropertyValue('--yv-viewport-offset-top')).toBe('0px')

    viewport.setMetrics({ height: 400, offsetTop: 50 })
    viewport.dispatch('resize')

    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('400px')
    expect(root.style.getPropertyValue('--yv-viewport-offset-top')).toBe('50px')

    cleanup()
  })

  it('clears the CSS properties while the WebView viewport reports a hidden height', () => {
    const root = createMockRoot()
    // Android inert sheet host: pre-warmed WebView reports height 0.
    const viewport = createMockVisualViewport({ height: 0, offsetTop: 0 })

    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    const cleanup = attachPickerKeyboardViewportListeners(root)

    // Stylesheet defaults (100vh / 0px) must win, so the shell is laid out at
    // full height before the sheet ever becomes visible.
    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('')
    expect(root.style.getPropertyValue('--yv-viewport-offset-top')).toBe('')

    // Sheet opens: the WebView becomes visible and fires resize with real metrics.
    viewport.setMetrics({ height: 800, offsetTop: 0 })
    viewport.dispatch('resize')

    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('800px')

    // Sheet closes again: the hidden-height report must not collapse the shell.
    viewport.setMetrics({ height: 0, offsetTop: 0 })
    viewport.dispatch('resize')

    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('')
    expect(root.style.getPropertyValue('--yv-viewport-offset-top')).toBe('')

    cleanup()
  })

  it('removes listeners on cleanup so later viewport events are ignored', () => {
    const root = createMockRoot()
    const viewport = createMockVisualViewport({ height: 800, offsetTop: 0 })

    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })

    const cleanup = attachPickerKeyboardViewportListeners(root)

    expect(viewport.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewport.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), {
      passive: true,
    })

    cleanup()

    expect(viewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))

    viewport.setMetrics({ height: 400, offsetTop: 0 })
    viewport.dispatch('resize')

    expect(root.style.getPropertyValue('--yv-visible-height')).toBe('800px')
  })
})
