import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { APP_URL } from '@/lib/appLink';
import { steerFor, type Steer } from '@/lib/browser';
import { theme } from './theme';

/**
 * A bar telling someone in the wrong browser how to get into the right one.
 *
 * See src/lib/browser.ts for why it has to exist and why iOS gets words where Android gets a
 * button. In short: installing GRam means Add to Home Screen, that menu item only exists in
 * Safari and Chrome, and the link gets shared through messaging apps that open it in their own
 * webview where the item is missing entirely.
 *
 * Dismissible, and dismissed only for this visit. Storing it would need a schema field, and the
 * banner is only ever seen on arrival anyway - by the second screen the person has either acted
 * on it or decided not to.
 */
export function OpenInBrowser() {
  const [gone, setGone] = useState(false);

  // Native builds are not in a browser, so there is nothing to steer anyone into.
  if (Platform.OS !== 'web' || gone) return null;

  const steer = detect();
  if (steer.kind === 'none') return null;

  return (
    <View style={s.bar} testID="open-in-browser">
      <Ionicons name="information-circle-outline" size={20} color={theme.color.accent} />
      <View style={s.body}>
        {steer.kind === 'safari' ? (
          <>
            <Text style={s.text}>
              <Text style={s.strong}>Open this in Safari to install it.</Text> Tap the share
              button, then Open in Safari. Add to Home Screen only exists there.
            </Text>
            {/*
              * Printed, not just copyable. The clipboard is refused often enough on iOS that
              * the button cannot be the only way to get the address out of here.
              */}
            <Text style={s.address} selectable>
              {APP_URL.replace('https://', '')}
            </Text>
          </>
        ) : (
          <Text style={s.text}>
            <Text style={s.strong}>Open this in Chrome to install it.</Text> Add to Home Screen
            only exists there.
          </Text>
        )}
        <View style={s.actions}>
          {steer.kind === 'chrome' ? (
            <Action
              label="Open in Chrome"
              testID="open-chrome"
              primary
              onPress={() => void Linking.openURL(steer.intentUrl).catch(() => undefined)}
            />
          ) : (
            <CopyAction />
          )}
          <Action label="Not now" testID="open-dismiss" onPress={() => setGone(true)} />
        </View>
      </View>
    </View>
  );
}

/**
 * The address, onto the clipboard, so it can be pasted into Safari's bar.
 *
 * The only thing that helps on iOS. Retyping a URL off a screen is where most people give up,
 * and the label has to confirm it worked or the tap feels like it did nothing.
 *
 * Two ways this fails and both are real: `navigator.clipboard` is absent on insecure origins
 * and in several webviews, and where it exists `writeText` still REJECTS if the document is
 * not focused. The second is the one that bites, because it looks like the API is there and
 * working right up until the promise settles. Uncaught, it is an unhandled rejection on top of
 * a screen the user is reading. Hence the catch and the address printed underneath, which is
 * the fallback that needs no permission from anyone.
 */
function CopyAction() {
  const [copied, setCopied] = useState(false);
  return (
    <Action
      label={copied ? 'Link copied' : 'Copy link'}
      testID="open-copy"
      primary
      onPress={() => {
        try {
          void navigator.clipboard
            ?.writeText(APP_URL)
            .then(() => setCopied(true))
            .catch(() => undefined);
        } catch {
          // Some webviews throw synchronously rather than rejecting.
        }
      }}
    />
  );
}

function Action({
  label,
  onPress,
  primary = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnGhost, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.btnLabel, !primary && { color: theme.color.textDim }]}>{label}</Text>
    </Pressable>
  );
}

/** Reads the two facts steerFor needs out of the browser, defensively. */
function detect(): Steer {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  let installed = false;
  try {
    installed =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      // Safari's own, older flag. Still the only one it sets on iOS.
      (navigator as { standalone?: boolean }).standalone === true;
  } catch {
    // matchMedia is missing in some webviews. Assuming not installed only risks showing a
    // banner to someone who did not need it, which is the cheaper mistake.
  }
  return steerFor(agent, installed);
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: theme.space(2),
    alignItems: 'flex-start',
    backgroundColor: theme.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  body: { flex: 1 },
  text: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 19 },
  strong: { color: theme.color.text, fontWeight: '700' },
  address: {
    color: theme.color.accent,
    fontSize: theme.font.small,
    fontWeight: '700',
    marginTop: theme.space(1.5),
  },
  actions: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2.5) },
  btn: {
    paddingVertical: theme.space(2),
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.sm,
  },
  btnPrimary: { backgroundColor: theme.color.accent },
  btnGhost: { backgroundColor: theme.color.surfaceAlt, borderWidth: 1, borderColor: theme.color.border },
  btnLabel: { color: theme.color.onAccent, fontWeight: '700', fontSize: theme.font.small },
});
