import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { MAX_FEEDBACK_CHARS, sendFeedback } from '@/lib/feedback';
import { Button, Card, Dim, H2 } from './components';
import { theme } from './theme';

type State = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * A box to say what is wrong with the app.
 *
 * There is no account, no crash reporting and no analytics in GRam, which is the point of it -
 * but it also means a bug on someone's phone is invisible unless they say so, and "find the
 * developer" is not a thing a person does mid-workout. This is the whole reporting channel.
 *
 * The note goes to the maintainer through the site's own host; see src/lib/feedback.ts for why
 * no email address appears anywhere in this app, and what the alternative would have cost.
 */
export function FeedbackCard() {
  const [message, setMessage] = useState('');
  const [state, setState] = useState<State>('idle');
  const version = Constants.expoConfig?.version ?? 'unknown';

  const trimmed = message.trim();

  async function handleSend() {
    if (trimmed.length === 0 || state === 'sending') return;
    setState('sending');
    const result = await sendFeedback(trimmed, version);
    setState(result === 'sent' ? 'sent' : 'failed');
    /*
     * The box is cleared only on success. A failed send leaves every word where it was, because
     * the usual reason it fails is no signal, and retyping a bug report you already wrote once
     * is how people decide not to bother reporting the next one.
     */
    if (result === 'sent') setMessage('');
  }

  return (
    <Card testID="feedback">
      <H2>Tell me something</H2>
      <Dim style={s.hint}>
        A bug, a wrong number, an exercise that is missing. It reaches me directly.
      </Dim>

      {state === 'sent' ? (
        <View style={s.sent} testID="feedback-sent">
          <Ionicons name="checkmark-circle" size={18} color={theme.color.accent} />
          <Text style={s.sentText}>Sent. Thank you — write another any time.</Text>
        </View>
      ) : null}

      <TextInput
        testID="feedback-message"
        value={message}
        onChangeText={(t) => {
          setMessage(t);
          // Any edit clears the last outcome: a red line under a box you are retyping is a
          // verdict on text that no longer exists.
          if (state !== 'idle') setState('idle');
        }}
        placeholder="What happened?"
        placeholderTextColor={theme.color.textFaint}
        style={s.input}
        multiline
        numberOfLines={4}
        maxLength={MAX_FEEDBACK_CHARS}
        textAlignVertical="top"
      />

      {state === 'failed' ? (
        <Dim style={s.failed} testID="feedback-failed">
          It did not go through — probably no signal. Your note is still here; try again when you
          are back online.
        </Dim>
      ) : null}

      <View style={s.actions}>
        {/*
          * Said before they type, not in a policy page. This is a network request out of an app
          * whose entire pitch is that nothing leaves the phone, so the exception has to be
          * stated where the exception is made.
          */}
        <Dim style={s.privacy}>
          Sends your message and the app version ({version}). Nothing else — not your name, not a
          single logged set.
        </Dim>
        <Button
          label={state === 'sending' ? 'Sending…' : 'Send'}
          onPress={() => void handleSend()}
          disabled={trimmed.length === 0 || state === 'sending'}
          testID="feedback-send"
        />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  hint: { marginTop: theme.space(1), lineHeight: 19 },
  input: {
    marginTop: theme.space(3),
    minHeight: 96,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2.5),
    color: theme.color.text,
    fontSize: theme.font.body,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    marginTop: theme.space(3),
  },
  privacy: { flex: 1, lineHeight: 18 },
  failed: { marginTop: theme.space(2), color: theme.color.warn, lineHeight: 19 },
  sent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    marginTop: theme.space(3),
    padding: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.accentDim,
    borderWidth: 1,
    borderColor: theme.color.accent,
  },
  sentText: { flex: 1, color: theme.color.text, fontSize: theme.font.small, fontWeight: '600' },
});
