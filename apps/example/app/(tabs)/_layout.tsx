import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function Layout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bible',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📖</Text>,
        }}
      />
      <Tabs.Screen
        name="verse-of-the-day"
        options={{
          title: 'Verse',
          tabBarIcon: ({ color }) => <Text style={{ color }}>☀️</Text>,
        }}
      />
      <Tabs.Screen
        name="bible-card"
        options={{
          title: 'BibleCard',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📜</Text>,
        }}
      />
    </Tabs>
  )
}
