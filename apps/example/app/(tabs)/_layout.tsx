import { NativeTabs } from 'expo-router/unstable-native-tabs'

export default function Layout() {
  return (
    <NativeTabs>
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
      <NativeTabs.Trigger name="auth-debug">
        <NativeTabs.Trigger.Label>Auth</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="lock.fill" md="lock" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
