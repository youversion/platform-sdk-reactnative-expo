import { Platform } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

// Matches SampleApp.swift tab bar selected color in platform-sdk-swift.
const TAB_TINT = '#F23B22'

// iOS 26+ renders the tab bar with Liquid Glass automatically when no explicit
// appearance is set. On iOS < 26 that same "no appearance" state leaves the tab
// bar's scrollEdgeAppearance transparent, so the tabs float over an invisible
// background. Gate on the major OS version: opt into an opaque material bar on
// pre-26, and leave the defaults untouched on 26+ so Liquid Glass can render.
const iosMajorVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0
const needsLegacyTabBarBackground = Platform.OS === 'ios' && iosMajorVersion < 26

// `disableTransparentOnScrollEdge` keeps the standard appearance at the scroll
// edge (instead of going transparent), and `blurEffect` gives it a visible
// system material so the bar reads as a normal pre-26 tab bar.
const legacyTabBarProps = needsLegacyTabBarBackground
  ? ({ disableTransparentOnScrollEdge: true, blurEffect: 'systemChromeMaterial' } as const)
  : {}

export default function Layout() {
  return (
    <NativeTabs tintColor={TAB_TINT} {...legacyTabBarProps}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Bible</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../assets/tabs/bible_stroked.png'),
            selected: require('../../assets/tabs/bible_filled.png'),
          }}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="content">
        <NativeTabs.Trigger.Label>Content</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('../../assets/tabs/box-video-stack_stroked.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="examples">
        <NativeTabs.Trigger.Label>Examples</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
