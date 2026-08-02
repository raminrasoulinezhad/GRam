import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfirmProvider } from '@/ui/confirm';
import { MilestoneCelebration } from '@/ui/Milestones';
import { Splash } from '@/ui/Splash';
import { theme } from '@/ui/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Splash>
          <ConfirmProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.color.bg },
              headerTintColor: theme.color.text,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.color.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="plan/[id]" options={{ title: 'Edit plan' }} />
            <Stack.Screen name="session/[id]" options={{ title: 'Workout' }} />
            <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise' }} />
            <Stack.Screen name="picker" options={{ presentation: 'modal', title: 'Add exercise' }} />
            <Stack.Screen name="history/[id]" options={{ title: 'Workout' }} />
            </Stack>
            <MilestoneCelebration />
          </ConfirmProvider>
        </Splash>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
