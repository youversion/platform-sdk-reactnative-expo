import { getPickerViewportCssProperties, getPickerViewportMetrics } from '../picker-keyboard-viewport'

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
      '--yv-keyboard-overlap': '350px',
      '--yv-visible-height': '400px',
      '--yv-viewport-offset-top': '50px',
    })
  })
})
