import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '@/store/useStore';
import { Card, Dim, H2 } from './components';
import { theme, themeAppliesImmediately, writeLaunchTheme } from './theme';
import { THEME_ORDER, THEMES, type ThemeId } from './themes';
import { reloadApp } from './useThemeSync';

/**
 * The theme picker.
 *
 * Each row paints itself in the palette it is offering rather than in the current one. A list
 * of names with a blurb underneath asks you to imagine eight colour schemes; a row that is
 * already wearing the thing shows you. It also makes the light themes obvious at a glance,
 * which is the choice most likely to surprise someone who taps blind.
 *
 * Choosing reloads the app - see theme.ts for why - so the card says so before you tap rather
 * than letting the screen appear to crash.
 */
export function ThemeCard() {
  const chosen = useStore((s) => s.settings.themeId);
  const updateSettings = useStore((s) => s.updateSettings);

  function choose(id: ThemeId) {
    if (id === chosen && id === theme.id) return;
    updateSettings({ themeId: id });
    // Written here as well as by useThemeSync so the reload below cannot outrun the store's
    // own persistence, which is asynchronous.
    const stuck = writeLaunchTheme(id);
    if (stuck && id !== theme.id) reloadApp();
  }

  return (
    <Card testID="theme-card">
      <H2>Look</H2>
      <Dim style={s.hint}>
        {themeAppliesImmediately
          ? 'The app reloads to change colour. Nothing is lost.'
          : 'Saved with your settings. It applies the next time the app starts.'}
      </Dim>

      <View style={s.list}>
        {THEME_ORDER.map((id) => (
          <ThemeRow key={id} id={id} selected={id === chosen} onPress={() => choose(id)} />
        ))}
      </View>
    </Card>
  );
}

function ThemeRow({
  id,
  selected,
  onPress,
}: {
  id: ThemeId;
  selected: boolean;
  onPress: () => void;
}) {
  const meta = THEMES[id];
  const c = meta.colors;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${meta.name}. ${meta.blurb}`}
      testID={`theme-${id}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: c.surface, borderColor: selected ? c.accent : c.border },
        selected && s.rowSelected,
        pressed && { opacity: 0.75 },
      ]}
    >
      {/* The ground colour, so a row shows what the app's background would become. */}
      <View style={[s.swatch, { backgroundColor: c.bg, borderColor: c.border }]}>
        <View style={[s.dot, { backgroundColor: c.accent }]} />
      </View>

      <View style={s.labels}>
        <Text style={[s.name, { color: c.text }]}>{meta.name}</Text>
        <Text style={[s.blurb, { color: c.textDim }]} numberOfLines={2}>
          {meta.blurb}
        </Text>
      </View>

      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={c.accent} testID={`theme-${id}-on`} />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  hint: { marginTop: theme.space(1), marginBottom: theme.space(2), lineHeight: 19 },
  list: { gap: theme.space(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(2.5),
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  rowSelected: { borderWidth: 2, padding: theme.space(2.5) - 1 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  labels: { flex: 1, gap: 2 },
  name: { fontSize: theme.font.body, fontWeight: '700' },
  blurb: { fontSize: theme.font.tiny, lineHeight: 15 },
});
