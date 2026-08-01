import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

/**
 * In-app confirmation dialog.
 *
 * React Native's Alert is a no-op under react-native-web (`static alert() {}`), which makes
 * every confirm-before-destroy flow silently dead in the browser and in a PWA build. A plain
 * Modal behaves identically on iOS, Android and web, matches the app's theme instead of an OS
 * dialog, and is driveable from tests.
 */
export type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the affirmative button. */
  confirmLabel?: string;
  /** Pass null for a single-button notice with nothing to cancel. */
  cancelLabel?: string | null;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Guards against a second confirm() opening while one is on screen.
  const busy = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (busy.current) return Promise.resolve(false);
    busy.current = true;
    return new Promise<boolean>((resolve) => {
      setPending({
        ...options,
        resolve: (ok) => {
          busy.current = false;
          setPending(null);
          resolve(ok);
        },
      });
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const cancelLabel = pending?.cancelLabel === undefined ? 'Cancel' : pending.cancelLabel;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => pending?.resolve(false)}
      >
        <Pressable style={s.backdrop} onPress={() => pending?.resolve(false)}>
          {/* Swallow taps on the card so they don't dismiss via the backdrop. */}
          <Pressable style={s.card} onPress={() => {}}>
            <Text style={s.title}>{pending?.title}</Text>
            {pending?.message ? <Text style={s.message}>{pending.message}</Text> : null}
            <View style={s.actions}>
              {cancelLabel !== null ? (
                <Pressable
                  accessibilityRole="button"
                  testID="confirm-cancel"
                  style={[s.btn, s.btnGhost]}
                  onPress={() => pending?.resolve(false)}
                >
                  <Text style={s.btnGhostLabel}>{cancelLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                testID="confirm-ok"
                style={[s.btn, pending?.destructive ? s.btnDanger : s.btnPrimary]}
                onPress={() => pending?.resolve(true)}
              >
                <Text style={[s.btnLabel, pending?.destructive && { color: '#2A0A0A' }]}>
                  {pending?.confirmLabel ?? 'OK'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside a ConfirmProvider');
  return confirm;
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(6),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space(5),
  },
  title: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: '700' },
  message: {
    color: theme.color.textDim,
    fontSize: theme.font.body,
    lineHeight: 21,
    marginTop: theme.space(2),
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.space(2),
    marginTop: theme.space(5),
  },
  btn: {
    paddingVertical: theme.space(2.5),
    paddingHorizontal: theme.space(4),
    borderRadius: theme.radius.md,
    minWidth: 88,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.color.accent },
  btnDanger: { backgroundColor: theme.color.danger },
  btnGhost: { backgroundColor: theme.color.surfaceAlt, borderWidth: 1, borderColor: theme.color.border },
  btnLabel: { color: '#04120A', fontWeight: '700', fontSize: theme.font.body },
  btnGhostLabel: { color: theme.color.textDim, fontWeight: '700', fontSize: theme.font.body },
});
