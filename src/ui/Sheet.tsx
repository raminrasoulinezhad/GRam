import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { theme } from './theme';

/**
 * The bottom sheet a compact field opens.
 *
 * Extracted at the third use. The date picker and the wheel field had grown identical copies of
 * this chrome - backdrop, rounded top, header rule, close button - and the theme picker would
 * have been a third. Three copies is where a shared component stops being speculative.
 *
 * The header is a slot rather than a string because the date picker puts a back button and a
 * breadcrumb in it, which a `title` prop could not express without growing three more props.
 */
export function Sheet({
  children,
  onClose,
  title,
  header,
  footer,
  testID,
}: {
  children: ReactNode;
  onClose: () => void;
  /** The common case: a heading and a close button. Ignored when `header` is given. */
  title?: string;
  /** Replaces the whole header row, close button included. */
  header?: ReactNode;
  footer?: ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet} testID={testID}>
          <View style={s.header}>
            {header ?? (
              <>
                <Text style={s.title}>{title}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={10}
                  onPress={onClose}
                  testID={testID ? `${testID.replace(/-sheet$/, '')}-close` : undefined}
                >
                  <Ionicons name="close" size={22} color={theme.color.textDim} />
                </Pressable>
              </>
            )}
          </View>

          <View style={s.body}>{children}</View>
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderTopWidth: 1,
    borderColor: theme.color.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    padding: theme.space(4),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  title: { flex: 1, color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  body: { padding: theme.space(4) },
  footer: { flexDirection: 'row', padding: theme.space(4), paddingTop: 0 },
});
