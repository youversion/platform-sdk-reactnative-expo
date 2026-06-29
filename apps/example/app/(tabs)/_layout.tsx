import { Platform } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

// iOS 26+ renders the tab bar with Liquid Glass automatically when no explicit
// appearance is set. On iOS < 26 that same "no appearance" state leaves the tab
// bar's scrollEdgeAppearance transparent, so the tabs float over an invisible
// background. Gate on the major OS version: opt into an opaque material bar on
// pre-26, and leave the defaults untouched on 26+ so Liquid Glass can render.
const iosMajorVersion =
  Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0
const needsLegacyTabBarBackground = Platform.OS === 'ios' && iosMajorVersion < 26

// `disableTransparentOnScrollEdge` keeps the standard appearance at the scroll
// edge (instead of going transparent), and `blurEffect` gives it a visible
// system material so the bar reads as a normal pre-26 tab bar.
const legacyTabBarProps = needsLegacyTabBarBackground
  ? ({ disableTransparentOnScrollEdge: true, blurEffect: 'systemChromeMaterial' } as const)
  : {}

export default function Layout() {
  return (
    <NativeTabs {...legacyTabBarProps}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bible</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="verse-of-the-day">
        <NativeTabs.Trigger.Label>VOTD</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sun.max.fill" md="wb_sunny" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bible-card">
        <NativeTabs.Trigger.Label>Card</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text.fill" md="article" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
