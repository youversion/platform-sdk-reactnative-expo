import { getVersionPickerPanelClassName } from '../version-picker-panels'

describe('getVersionPickerPanelClassName', () => {
  it('shows the version panel when the language panel is closed', () => {
    expect(getVersionPickerPanelClassName(false, 'version')).toContain('yv:opacity-100')
    expect(getVersionPickerPanelClassName(false, 'language')).toContain('yv:opacity-0')
  })

  it('shows the language panel when the language panel is open', () => {
    expect(getVersionPickerPanelClassName(true, 'version')).toContain('yv:opacity-0')
    expect(getVersionPickerPanelClassName(true, 'language')).toContain('yv:opacity-100')
  })

  it('includes transition utilities on both panels', () => {
    expect(getVersionPickerPanelClassName(false, 'version')).toContain('yv:duration-300')
    expect(getVersionPickerPanelClassName(false, 'language')).toContain('yv:duration-300')
  })

  it('positions the language panel as an absolute overlay', () => {
    expect(getVersionPickerPanelClassName(false, 'language')).toContain('yv:absolute')
    expect(getVersionPickerPanelClassName(false, 'language')).toContain('yv:inset-0')
  })
})
