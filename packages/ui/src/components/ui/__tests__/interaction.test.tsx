import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { withAlpha } from '../../../lib/color'
import { SDK_POPOVER_HOST_NAME } from '../../../lib/sdk-portal-hosts'
import { youVersionProviderWrapper } from '../../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../../theme'
import { sansFace } from '../../../theme/fonts'
import { Accordion } from '../accordion'
import { Popover } from '../popover'
import { Tabs } from '../tabs'
import { Text } from '../text'

const light = getTokens('light')
const dark = getTokens('dark')

function viewStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style)
}

function textStyle(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style)
}

function TabsHarness() {
  const [value, setValue] = useState('versions')
  return (
    <Tabs value={value} onValueChange={setValue} testID="tabs">
      <Tabs.List testID="tabs-list">
        <Tabs.Trigger value="versions" testID="tab-versions">
          <Tabs.Text>Versions</Tabs.Text>
        </Tabs.Trigger>
        <Tabs.Trigger value="languages" testID="tab-languages">
          <Tabs.Text>Languages</Tabs.Text>
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="versions" testID="panel-versions">
        <Text>Version list</Text>
      </Tabs.Content>
      <Tabs.Content value="languages" testID="panel-languages">
        <Text>Language list</Text>
      </Tabs.Content>
    </Tabs>
  )
}

function renderTabs(theme: 'light' | 'dark' = 'light') {
  render(<TabsHarness />, { wrapper: youVersionProviderWrapper(theme) })
}

describe('Tabs', () => {
  it('paints the list from the muted token and the selected trigger from background', () => {
    renderTabs('light')

    expect(viewStyle('tabs-list')).toMatchObject({
      backgroundColor: light.muted,
      height: 36,
      padding: 3,
      borderRadius: 8,
    })
    expect(viewStyle('tab-versions')).toMatchObject({
      backgroundColor: light.background,
      borderColor: 'transparent',
    })
    expect(viewStyle('tab-languages')).toMatchObject({
      backgroundColor: 'transparent',
    })
    expect(textStyle('Versions')).toMatchObject({
      color: light.foreground,
      ...sansFace(light.fontFamily.sans, 500),
      ...light.typography.sm,
    })
  })

  it('fills a selected trigger from the dark input alpha and mutes idle labels', () => {
    renderTabs('dark')

    expect(viewStyle('tabs-list')).toMatchObject({ backgroundColor: dark.muted })
    expect(viewStyle('tab-versions')).toMatchObject({
      backgroundColor: withAlpha(dark.input, 0.3),
      borderColor: withAlpha(dark.foreground, 0.1),
    })
    expect(textStyle('Versions')).toMatchObject({ color: dark.foreground })
    expect(textStyle('Languages')).toMatchObject({ color: dark.mutedForeground })
  })

  it('shows the selected panel and switches on trigger press', () => {
    renderTabs()

    expect(screen.getByText('Version list')).toBeTruthy()
    expect(screen.queryByText('Language list')).toBeNull()

    fireEvent.press(screen.getByRole('tab', { name: 'Languages' }))

    expect(screen.getByText('Language list')).toBeTruthy()
    expect(screen.queryByText('Version list')).toBeNull()
    expect(viewStyle('tab-languages')).toMatchObject({ backgroundColor: light.background })
    expect(viewStyle('tab-versions')).toMatchObject({ backgroundColor: 'transparent' })
  })

  it('throws when Tabs.Text renders outside a trigger', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Tabs.Text>Orphan</Tabs.Text>)).toThrow(/inside <Tabs.Trigger>/)

    consoleError.mockRestore()
  })

  it('lets a caller style win on the list', () => {
    render(
      <Tabs value="versions" onValueChange={() => {}}>
        <Tabs.List testID="tabs-list" style={{ backgroundColor: light.card }}>
          <Tabs.Trigger value="versions">
            <Tabs.Text>Versions</Tabs.Text>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('tabs-list')).toMatchObject({ backgroundColor: light.card })
  })

  it('dims a disabled trigger and a caller opacity cannot win', () => {
    render(
      <Tabs value="versions" onValueChange={() => {}}>
        <Tabs.List>
          <Tabs.Trigger value="versions" disabled style={{ opacity: 1 }} testID="tab-versions">
            <Tabs.Text>Versions</Tabs.Text>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('tab-versions')).toMatchObject({ opacity: 0.5 })
    expect(screen.getByTestId('tab-versions').props.accessibilityState).toMatchObject({
      disabled: true,
    })
  })
})

function BookAccordionItems() {
  return (
    <>
      <Accordion.Item value="genesis" testID="item-genesis">
        <Accordion.Trigger>
          <Accordion.Text>Genesis</Accordion.Text>
        </Accordion.Trigger>
        <Accordion.Content>
          <Text>Genesis chapters</Text>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="exodus" testID="item-exodus">
        <Accordion.Trigger>
          <Accordion.Text>Exodus</Accordion.Text>
        </Accordion.Trigger>
        <Accordion.Content>
          <Text>Exodus chapters</Text>
        </Accordion.Content>
      </Accordion.Item>
    </>
  )
}

function AccordionHarness({
  collapsible = true,
  defaultValue,
}: {
  collapsible?: boolean
  defaultValue?: string
}) {
  return (
    <Accordion type="single" collapsible={collapsible} defaultValue={defaultValue}>
      <BookAccordionItems />
    </Accordion>
  )
}

describe('Accordion', () => {
  it('paints item dividers from the border token in light', () => {
    render(<AccordionHarness defaultValue="genesis" />, {
      wrapper: youVersionProviderWrapper('light'),
    })

    expect(viewStyle('item-genesis')).toMatchObject({
      borderBottomWidth: 1,
      borderBottomColor: light.border,
    })
    expect(textStyle('Genesis')).toMatchObject({
      color: light.foreground,
      ...sansFace(light.fontFamily.sans, 500),
      ...light.typography.sm,
    })
  })

  it('resolves the divider from the dark border token', () => {
    render(<AccordionHarness defaultValue="genesis" />, {
      wrapper: youVersionProviderWrapper('dark'),
    })

    expect(viewStyle('item-genesis')).toMatchObject({ borderBottomColor: dark.border })
    expect(textStyle('Genesis')).toMatchObject({ color: dark.foreground })
  })

  it('opens the default item and switches on trigger press', () => {
    render(<AccordionHarness collapsible defaultValue="genesis" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(screen.getByText('Genesis chapters')).toBeTruthy()
    expect(screen.queryByText('Exodus chapters')).toBeNull()

    fireEvent.press(screen.getByRole('button', { name: 'Exodus' }))

    expect(screen.getByText('Exodus chapters')).toBeTruthy()
    expect(screen.queryByText('Genesis chapters')).toBeNull()
  })

  it('collapses the open item when collapsible', () => {
    render(<AccordionHarness collapsible defaultValue="genesis" />, {
      wrapper: youVersionProviderWrapper(),
    })

    fireEvent.press(screen.getByRole('button', { name: 'Genesis' }))

    expect(screen.queryByText('Genesis chapters')).toBeNull()
  })

  it('keeps multiple items open when type is multiple', () => {
    render(
      <Accordion type="multiple" collapsible defaultValue={['genesis']}>
        <BookAccordionItems />
      </Accordion>,
      { wrapper: youVersionProviderWrapper() },
    )

    fireEvent.press(screen.getByRole('button', { name: 'Exodus' }))

    expect(screen.getByText('Genesis chapters')).toBeTruthy()
    expect(screen.getByText('Exodus chapters')).toBeTruthy()
  })

  it('throws when Accordion.Text renders outside a trigger', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Accordion.Text>Orphan</Accordion.Text>)).toThrow(
      /inside <Accordion.Trigger>/,
    )

    consoleError.mockRestore()
  })

  it('forwards the combined disabled flag and a caller opacity cannot win', () => {
    render(
      <Accordion type="single" collapsible disabled>
        <Accordion.Item value="genesis">
          <Accordion.Trigger testID="trigger-genesis" style={{ opacity: 1 }}>
            <Accordion.Text>Genesis</Accordion.Text>
          </Accordion.Trigger>
          <Accordion.Content>
            <Text>Genesis chapters</Text>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('trigger-genesis')).toMatchObject({ opacity: 0.5 })
    expect(screen.getByTestId('trigger-genesis').props.disabled).toBe(true)

    fireEvent.press(screen.getByTestId('trigger-genesis'))

    expect(screen.queryByText('Genesis chapters')).toBeNull()
  })

  it('dims when the item is disabled without a local trigger flag', () => {
    render(
      <Accordion type="single" collapsible>
        <Accordion.Item value="genesis" disabled>
          <Accordion.Trigger testID="trigger-genesis" style={{ opacity: 1 }}>
            <Accordion.Text>Genesis</Accordion.Text>
          </Accordion.Trigger>
          <Accordion.Content>
            <Text>Genesis chapters</Text>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('trigger-genesis')).toMatchObject({ opacity: 0.5 })
    expect(screen.getByTestId('trigger-genesis').props.disabled).toBe(true)
  })
})

function patchMeasureOnNode(
  node: {
    measure: (callback: (...args: number[]) => void) => void
  } | null,
) {
  if (node === null) {
    return
  }
  node.measure = (callback) => {
    callback(0, 0, 80, 40, 12, 80)
  }
}

function PopoverHarness() {
  return (
    <Popover>
      <Popover.Trigger testID="popover-trigger" ref={patchMeasureOnNode}>
        <Text>Open filter</Text>
      </Popover.Trigger>
      <Popover.Content testID="popover-content" overlayTestID="popover-overlay">
        <Popover.Text>Filter options</Popover.Text>
        <Popover.Close testID="popover-close">
          <Text>Done</Text>
        </Popover.Close>
      </Popover.Content>
    </Popover>
  )
}

describe('Popover', () => {
  it('keeps content closed until the trigger is pressed', () => {
    render(<PopoverHarness />, { wrapper: youVersionProviderWrapper() })

    expect(screen.queryByText('Filter options')).toBeNull()
    expect(screen.queryByTestId('popover-content')).toBeNull()
  })

  it('opens token-styled content on trigger press and closes from Close', () => {
    render(<PopoverHarness />, { wrapper: youVersionProviderWrapper() })
    fireEvent.press(screen.getByRole('button', { name: 'Open filter' }))

    expect(screen.getByText('Filter options')).toBeTruthy()
    expect(viewStyle('popover-content')).toMatchObject({
      backgroundColor: light.popover,
      borderColor: light.border,
      borderWidth: 1,
      borderRadius: light.radius.surface,
      width: 288,
      padding: 16,
    })
    expect(textStyle('Filter options')).toMatchObject({
      color: light.popoverForeground,
      ...sansFace(light.fontFamily.sans, 500),
      ...light.typography.sm,
    })
    expect(screen.getByTestId('rn-primitives-portal').props.accessibilityLabel).toBe(
      SDK_POPOVER_HOST_NAME,
    )

    fireEvent.press(screen.getByText('Done'))

    expect(screen.queryByText('Filter options')).toBeNull()
  })

  it('paints content from the dark popover tokens', () => {
    render(<PopoverHarness />, { wrapper: youVersionProviderWrapper('dark') })
    fireEvent.press(screen.getByRole('button', { name: 'Open filter' }))

    expect(viewStyle('popover-content')).toMatchObject({
      backgroundColor: dark.popover,
      borderColor: dark.border,
    })
    expect(textStyle('Filter options')).toMatchObject({ color: dark.popoverForeground })
  })

  it('dismisses when the overlay is pressed', () => {
    render(<PopoverHarness />, { wrapper: youVersionProviderWrapper() })
    fireEvent.press(screen.getByRole('button', { name: 'Open filter' }))
    expect(screen.getByText('Filter options')).toBeTruthy()

    fireEvent.press(screen.getByTestId('popover-overlay', { includeHiddenElements: true }))

    expect(screen.queryByText('Filter options')).toBeNull()
  })

  it('throws when Popover.Text renders outside content', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Popover.Text>Orphan</Popover.Text>)).toThrow(/inside <Popover.Content>/)

    consoleError.mockRestore()
  })

  it('dims a disabled trigger and a caller opacity cannot win', () => {
    render(
      <Popover>
        <Popover.Trigger disabled style={{ opacity: 1 }} testID="popover-trigger">
          <Text>Open filter</Text>
        </Popover.Trigger>
        <Popover.Content>
          <Popover.Text>Filter options</Popover.Text>
        </Popover.Content>
      </Popover>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(viewStyle('popover-trigger')).toMatchObject({ opacity: 0.5 })
    fireEvent.press(screen.getByTestId('popover-trigger'))
    expect(screen.queryByText('Filter options')).toBeNull()
  })
})
