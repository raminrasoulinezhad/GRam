import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { beep, primeBeep } from '@/lib/beep';
import { formatDuration } from '@/lib/format';
import { Button, Dim } from './components';
import { Sheet } from './Sheet';
import { theme } from './theme';

/** Seconds of lead-in between pressing Start and the set beginning. */
export const LEAD_IN_SEC = 5;

type Phase =
  | { at: 'ready' }
  /** Counting into the set. `from` is when Start was pressed. */
  | { at: 'leadIn'; from: number }
  /** The set itself. `from` is when the lead-in ended. */
  | { at: 'running'; from: number }
  | { at: 'done'; seconds: number };

/**
 * Times a held set - a plank, a wall sit, a dead hang.
 *
 * These are the only sets you cannot count. Everything else in the app is recorded after the
 * fact from a number you know; a sixty-second plank has to be measured while it happens, and
 * the phone is on the floor in front of you rather than in your hand.
 *
 * So: a five-second lead-in to get into position, the time on screen large enough to read from
 * the floor, and a sound at the end because by then you are probably not looking at it.
 *
 * EVERY CLOCK IS ANCHORED TO A TIMESTAMP
 * Nothing counts ticks. The interval only decides how often the screen is repainted; the number
 * shown is always derived from `Date.now()` minus a stored start. A dropped frame, a background
 * tab throttled to one tick a second, a phone that slept - none of them can make the recorded
 * time wrong, which for the one control whose entire job is measuring would be unforgivable.
 */
export function HoldTimer({
  target: planned,
  onDone,
  onClose,
}: {
  /** The set's planned length in seconds. */
  target: number;
  /** Called with the seconds actually held. */
  onDone: (seconds: number) => void;
  onClose: () => void;
}) {
  /*
   * Frozen at mount, and that is load-bearing.
   *
   * Finishing writes the held time back into the very field this prop reads, so a set stopped
   * early at 7 of 45 seconds re-rendered with `target` now 7 - and the sheet congratulated the
   * user on completing it. The goal has to be what it was when the timer started, not what the
   * set says after being recorded.
   */
  const [target] = useState(planned);
  const [phase, setPhase] = useState<Phase>({ at: 'ready' });
  const [now, setNow] = useState(() => Date.now());
  const beeped = useRef(false);

  // Repaint often enough that the seconds never look stuck, which four times a second does.
  useEffect(() => {
    if (phase.at === 'ready' || phase.at === 'done') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase.at]);

  const elapsed = (from: number) => Math.max(0, Math.floor((now - from) / 1000));

  // The lead-in ending and the set ending are both consequences of the clock, so both are
  // decided here rather than by a timer that could fire late.
  useEffect(() => {
    if (phase.at === 'leadIn' && now - phase.from >= LEAD_IN_SEC * 1000) {
      /*
       * The sound that matters most. By now the phone is on the floor and you are looking at
       * the ceiling, so this is the only way to know the five seconds are up and the clock you
       * will be measured against has started.
       */
      beep('go');
      setPhase({ at: 'running', from: phase.from + LEAD_IN_SEC * 1000 });
      return;
    }
    if (phase.at === 'running' && target > 0 && elapsed(phase.from) >= target && !beeped.current) {
      beeped.current = true;
      beep('done');
      setPhase({ at: 'done', seconds: target });
      onDone(target);
    }
  });

  function start() {
    // Inside the gesture, which is the only moment a browser will open the audio device. The
    // press beep rides that same tap, so it doubles as proof the device actually opened - if
    // you hear it, the two beeps that come later while the phone is face down will work too.
    primeBeep();
    beep('press');
    // Cleared so a second run in the same sheet can beep again.
    beeped.current = false;
    setNow(Date.now());
    setPhase({ at: 'leadIn', from: Date.now() });
  }

  function stopEarly() {
    if (phase.at !== 'running') return onClose();
    const held = elapsed(phase.from);
    // The same sound as running out of time, because it is the same event: the set is over.
    beeped.current = true;
    beep('done');
    setPhase({ at: 'done', seconds: held });
    onDone(held);
  }

  return (
    <Sheet title="Timed set" onClose={onClose} testID="hold-sheet">
      <View style={s.face}>
        {phase.at === 'ready' ? (
          <>
            <Text style={s.big} testID="hold-target">
              {formatDuration(target)}
            </Text>
            <Dim style={s.caption}>
              {LEAD_IN_SEC} seconds to get set, then it starts counting.
            </Dim>
          </>
        ) : null}

        {phase.at === 'leadIn' ? (
          <>
            {/* Counts 5, 4, 3... Ceil so it reads 5 the instant Start is pressed, not 4. */}
            <Text style={[s.big, s.leadIn]} testID="hold-leadin">
              {Math.max(1, Math.ceil(LEAD_IN_SEC - (now - phase.from) / 1000))}
            </Text>
            <Dim style={s.caption}>Get into position</Dim>
          </>
        ) : null}

        {phase.at === 'running' ? (
          <>
            {/*
              * Counting down to zero rather than up. What a held set needs is "how much
              * longer", and reading that off an ascending number means doing arithmetic while
              * shaking. Overrun is shown as elapsed instead, below.
              */}
            <Text style={s.big} testID="hold-remaining">
              {formatDuration(Math.max(0, target - elapsed(phase.from)))}
            </Text>
            <Dim style={s.caption}>{formatDuration(elapsed(phase.from))} held</Dim>
          </>
        ) : null}

        {phase.at === 'done' ? (
          <>
            <Text style={[s.big, s.done]} testID="hold-done">
              {formatDuration(phase.seconds)}
            </Text>
            <Dim style={s.caption}>
              {phase.seconds >= target ? 'Set complete, and recorded.' : 'Stopped early, and recorded.'}
            </Dim>
          </>
        ) : null}
      </View>

      <View style={s.buttons}>
        {phase.at === 'ready' ? (
          <Button label="Start" style={{ flex: 1 }} onPress={start} testID="hold-start" />
        ) : null}

        {phase.at === 'leadIn' || phase.at === 'running' ? (
          <Button
            label={phase.at === 'running' ? 'Finish' : 'Cancel'}
            variant={phase.at === 'running' ? 'primary' : 'secondary'}
            style={{ flex: 1 }}
            onPress={phase.at === 'running' ? stopEarly : onClose}
            testID="hold-finish"
          />
        ) : null}

        {phase.at === 'done' ? (
          <Button label="Close" style={{ flex: 1 }} onPress={onClose} testID="hold-close" />
        ) : null}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  face: { alignItems: 'center', paddingVertical: theme.space(6), gap: theme.space(2) },
  // Big enough to read from the floor, which is where the phone is during a plank.
  big: { color: theme.color.text, fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  leadIn: { color: theme.color.warn },
  done: { color: theme.color.accent },
  caption: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: theme.space(2), paddingTop: theme.space(2) },
});
