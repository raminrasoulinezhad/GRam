import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackupReminder } from '@/ui/BackupReminder';
import { ConfirmProvider } from '@/ui/confirm';
import { ExerciseSheetProvider } from '@/ui/ExerciseSheet';
import { MilestoneCelebration } from '@/ui/Milestones';
import { Splash } from '@/ui/Splash';
import { useAutoBackup } from '@/ui/useAutoBackup';
import { useVersionLog } from '@/ui/useVersionLog';
import { useViewportHeight } from '@/ui/useViewportHeight';
import { theme } from '@/ui/theme';

export default function RootLayout() {
  // At the root so the backup file tracks the data, not whichever screen happens to be open.
  useAutoBackup();
  // Keeps the layout inside the space the on-screen keyboard leaves.
  useViewportHeight();
  // Records which builds this device has run, for Profile > About.
  useVersionLog();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Splash>
          <ConfirmProvider>
            <ExerciseSheetProvider>
          {/* Above the navigator so it is visible on every screen, not just the tabs. */}
          <BackupReminder />
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
            </ExerciseSheetProvider>
          </ConfirmProvider>
        </Splash>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
