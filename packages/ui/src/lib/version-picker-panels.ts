const PANEL_TRANSITION =
  'yv:min-h-0 yv:h-full yv:transition-all yv:duration-300 yv:ease-out yv:motion-reduce:transition-none'

const PANEL_VISIBLE = 'yv:grow yv:opacity-100 yv:pointer-events-auto yv:blur-none yv:scale-100'
const PANEL_HIDDEN = 'yv:shrink yv:opacity-0 yv:pointer-events-none yv:blur-sm yv:scale-95'

export function getVersionPickerPanelClassName(
  showLanguagePicker: boolean,
  panel: 'version' | 'language',
): string {
  if (panel === 'version') {
    return `${PANEL_TRANSITION} ${showLanguagePicker ? PANEL_HIDDEN : PANEL_VISIBLE}`
  }

  return `${PANEL_TRANSITION} yv:absolute yv:inset-0 ${showLanguagePicker ? PANEL_VISIBLE : PANEL_HIDDEN}`
}
