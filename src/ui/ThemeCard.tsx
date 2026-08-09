import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '@/store/useStore';
import { Card, Dim, H2 } from './components';
import { Sheet } from './Sheet';
import { theme, themeAppliesImmediately, writeLaunchTheme } from './theme';
import { THEME_ORDER, THEMES, type ThemeId } from './themes';
import { wasPickerOpen } from './themeReload';
import { reloadApp } from './useThemeSync';

/**
 * Choosing how the app looks.
 *
 * A FIELD, NOT A LIST
 * The nine palettes used to sit open on the page. That was 769px on an 812px phone - a whole
 * screen, and a third of the Profile page - for a setting most people touch twice ever. It is
 * now the same control as date of birth, height and weight: one line saying what is selected,
 * and a sheet behind it. The page lost about 680px.
 *
 * Each row in the sheet paints itself in the palette it is offering rather than in the current
 * one. A list of names with a blurb underneath asks you to imagine nine colour schemes; a row
 * already wearing the thing shows you. It is also what makes the light themes obvious to
 * someone about to tap blind.
 */
export function ThemeCard() {
  const chosen = useStore((s) => s.settings.themeId);
  const updateSettings = useStore((s) => s.updateSettings);
  // Reopened after a theme change so trying a second colour is one tap, not four.
  const [open, setOpen] = useState(() => wasPickerOpen());

  const current = THEMES[chosen] ?? THEMES[theme.id];

  function choose(id: ThemeId) {
    if (id === chosen && id === theme.id) return setOpen(false);

    updateSettings({ themeId: id });
    /*
     * Written here as well as by useThemeSync, because the reload below would otherwise race
     * the store's own persistence, which is asynchronous.
     */
    const stuck = writeLaunchTheme(id);
    if (!stuck || id === theme.id) return setOpen(false);

    /*
     * Applied on tap rather than behind a Done button: this is a choice you make by looking at
     * it, and a confirm step on something instantly reversible is a tax on browsing. The `true`
     * asks for the picker to come back open on the far side of the reload, so trying the next
     * colour is one tap rather than four.
     */
    reloadApp(true);
  }

  return (
    <Card testID="theme-card">
      <H2>Look</H2>
      <Dim style={s.hint}>
        {themeAppliesImmediately
          ? 'The app reloads to change colour. Nothing is lost.'
          : 'Saved with your settings. It applies the next time the app starts.'}
      </Dim>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Look: ${current.name}. ${current.blurb}`}
        testID="theme-field"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.field, pressed && { opacity: 0.7 }]}
      >
        <View style={[s.swatch, { backgroundColor: current.colors.bg, borderColor: current.colors.border }]}>
          <View style={[s.dot, { backgroundColor: current.colors.accent }]} />
        </View>
        <Text style={s.fieldText} numberOfLines={1}>
          {current.name}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.color.textFaint} />
      </Pressable>

      {open ? (
        <Sheet title="Look" onClose={() => setOpen(false)} testID="theme-sheet">
          {/*
            * Scrollable, because nine full-width rows are taller than the half-screen a sheet
            * gets on a phone. Bounded so the sheet cannot grow past the screen on a tablet.
            */}
          <ScrollView style={s.list} contentContainerStyle={{ gap: theme.space(2) }}>
            {THEME_ORDER.map((id) => (
              <ThemeRow key={id} id={id} selected={id === chosen} onPress={() => choose(id)} />
            ))}
          </ScrollView>
        </Sheet>
      ) : null}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(2.5),
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surfaceAlt,
  },
  fieldText: { flex: 1, color: theme.color.text, fontSize: theme.font.body, fontWeight: '700' },
  // Tall enough to show the nine, short enough to leave the page visible behind the sheet.
  list: { maxHeight: 420 },
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
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  labels: { flex: 1, gap: 2 },
  name: { fontSize: theme.font.body, fontWeight: '700' },
  blurb: { fontSize: theme.font.tiny, lineHeight: 15 },
});
