import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { exerciseName } from '@/catalog';
import { ExerciseDetail } from './ExerciseDetail';
import { theme } from './theme';

/**
 * Opens an exercise's full description over whatever you were doing.
 *
 * Tapping a thumbnail mid-workout should answer "how do I do this again" without losing your
 * place in the session, so this is a sheet you close rather than a page you navigate away to.
 * The content is the same component the full page renders.
 */
const SheetContext = createContext<((exerciseId: string) => void) | null>(null);

export function ExerciseSheetProvider({ children }: { children: ReactNode }) {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const open = useCallback((id: string) => setExerciseId(id), []);
  const value = useMemo(() => open, [open]);

  return (
    <SheetContext.Provider value={value}>
      {children}
      {exerciseId !== null ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setExerciseId(null)}>
          <View style={s.backdrop}>
            <View style={s.sheet}>
              <View style={s.header}>
                <Text style={s.title} numberOfLines={2}>
                  {exerciseName(exerciseId)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  testID="exercise-sheet-close"
                  hitSlop={12}
                  onPress={() => setExerciseId(null)}
                  style={s.close}
                >
                  <Ionicons name="close" size={22} color={theme.color.text} />
                </Pressable>
              </View>
              <ExerciseDetail exerciseId={exerciseId} />
            </View>
          </View>
        </Modal>
      ) : null}
    </SheetContext.Provider>
  );
}

/**
 * Opens the description sheet. Returns null outside the provider rather than throwing, so a
 * thumbnail can render in a test or a screenshot without one.
 */
export function useExerciseSheet(): ((exerciseId: string) => void) | null {
  return useContext(SheetContext);
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    height: '92%',
    backgroundColor: theme.color.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  title: { flex: 1, color: theme.color.text, fontSize: theme.font.h3, fontWeight: '700' },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
