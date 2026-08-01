import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { theme } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.bg },
        headerTintColor: theme.color.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 20 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textFaint,
        sceneStyle: { backgroundColor: theme.color.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="body"
        options={{
          title: 'Body',
          tabBarIcon: ({ color, size }) => <Ionicons name="body" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
