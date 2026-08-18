import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  /**
   * Holds the affirmative button shut until this word is typed.
   *
   * For the one or two actions where a mistap is unrecoverable. Two buttons stop an accident;
   * they do not stop a decision made in three seconds, and a dialog answered a hundred times
   * stops being read at all. Typing something is the smallest thing that cannot be done by
   * muscle memory.
   *
   * Reserve it. On anything reversible it is theatre, and theatre is what teaches people to
   * click through the real one.
   */
  requireText?: { value: string; prompt: string; placeholder?: string };
};

/**
 * Whether what was typed counts.
 *
 * Trimmed and case-insensitive. The point is to prove the action is deliberate, and a person
 * who typed their own name with a trailing space or the wrong capital has proved that. Being
 * stricter would only teach them to copy and paste it, which proves nothing.
 */
export function matchesRequired(typed: string, required: string): boolean {
  return typed.trim().toLocaleLowerCase() === required.trim().toLocaleLowerCase();
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState('');
  // Guards against a second confirm() opening while one is on screen.
  const busy = useRef(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (busy.current) return Promise.resolve(false);
    busy.current = true;
    // Cleared on the way in as well as out, so a dialog never opens holding the last answer.
    setTyped('');
    return new Promise<boolean>((resolve) => {
      setPending({
        ...options,
        resolve: (ok) => {
          busy.current = false;
          setPending(null);
          setTyped('');
          resolve(ok);
        },
      });
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const cancelLabel = pending?.cancelLabel === undefined ? 'Cancel' : pending.cancelLabel;
  const required = pending?.requireText ?? null;
  const armed = required === null || matchesRequired(typed, required.value);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {/*
        Mounted only while a dialog is pending. react-native-web's Modal does NOT unmount
        its children when visible={false} - it leaves them in the DOM, laid out and without
        aria-hidden, so a screen reader would announce a phantom "Cancel / OK" on every
        screen. Gating the whole element is also one less subtree to keep around.
      */}
      {pending !== null ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => pending.resolve(false)}>
          <Pressable style={s.backdrop} onPress={() => pending.resolve(false)}>
            {/* Swallow taps on the card so they don't dismiss via the backdrop. */}
            <Pressable style={s.card} onPress={() => {}}>
              <Text style={s.title}>{pending.title}</Text>
              {pending.message ? <Text style={s.message}>{pending.message}</Text> : null}
              {required !== null ? (
                <>
                  <Text style={s.prompt}>{required.prompt}</Text>
                  <TextInput
                    testID="confirm-text"
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={required.placeholder}
                    placeholderTextColor={theme.color.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    // Nothing here should be offered from a saved form or a password manager.
                    autoComplete="off"
                    style={s.input}
                    // Enter finishes it, but only once the word is right. A dialog that fires
                    // on Enter regardless is worse than one with no gate at all.
                    onSubmitEditing={() => {
                      if (armed) pending.resolve(true);
                    }}
                  />
                </>
              ) : null}
              <View style={s.actions}>
                {cancelLabel !== null ? (
                  <Pressable
                    accessibilityRole="button"
                    testID="confirm-cancel"
                    style={[s.btn, s.btnGhost]}
                    onPress={() => pending.resolve(false)}
                  >
                    <Text style={s.btnGhostLabel}>{cancelLabel}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !armed }}
                  testID="confirm-ok"
                  disabled={!armed}
                  style={[
                    s.btn,
                    pending.destructive ? s.btnDanger : s.btnPrimary,
                    // Shown rather than hidden while it is shut: the button is where the eye
                    // already is, and a greyed one beside the box explains the box.
                    !armed && s.btnShut,
                  ]}
                  onPress={() => pending.resolve(true)}
                >
                  <Text style={[s.btnLabel, pending.destructive && { color: theme.color.onDanger }]}>
                    {pending.confirmLabel ?? 'OK'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  prompt: {
    color: theme.color.text,
    fontSize: theme.font.small,
    fontWeight: '700',
    marginTop: theme.space(4),
    marginBottom: theme.space(2),
  },
  input: {
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2.5),
    color: theme.color.text,
    fontSize: theme.font.body,
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
  btnShut: { opacity: 0.4 },
  btnLabel: { color: theme.color.onAccent, fontWeight: '700', fontSize: theme.font.body },
  btnGhostLabel: { color: theme.color.textDim, fontWeight: '700', fontSize: theme.font.body },
});
