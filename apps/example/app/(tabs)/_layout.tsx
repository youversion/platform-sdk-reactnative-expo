import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Bible',
          tabBarIcon: ({ color }) => <Text style={{ color }}>📖</Text>,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          headerShown: false,
          title: 'Explore',
          tabBarIcon: ({ color }) => <Text style={{ color }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="verse-of-the-day"
        options={{
          headerShown: false,
          title: 'Verse',
          tabBarIcon: ({ color }) => <Text style={{ color }}>☀️</Text>,
        }}
      />
    </Tabs>
  )
}
