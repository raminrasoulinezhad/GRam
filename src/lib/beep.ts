import { Platform, Vibration } from 'react-native';

/**
 * The sounds the hold timer makes.
 *
 * Synthesised rather than played from a file. A plank is timed with the phone face down on a
 * bench, so the set has to be audible without looking - but shipping audio assets to say "beep"
 * costs a download, a licence question and a cache entry, and these are sine waves. The browser
 * can make them.
 *
 * WHY IT HAS TO BE PRIMED
 * Browsers refuse to start audio except in response to a real user gesture, and two of these
 * are wanted seconds or minutes *after* the tap that started the timer. So the audio context is
 * opened during the tap, while permission is granted, and then kept - the later beeps just
 * write to a context that is already running. Without priming the first beep of a session is
 * silently dropped, which is the worst kind of failure here: you only find out by missing it.
 */

/**
 * Three sounds, because they answer three different questions and the phone is face down for
 * two of them.
 *
 * `press` confirms the button you just touched registered. `go` is the one that matters most -
 * it says the lead-in is over and the clock is running, which is the moment you have to already
 * be holding the position. `done` says stop.
 *
 * They are deliberately not the same sound at different volumes. Rising means started, falling
 * means finished, and you can tell which one you missed from the next one you hear.
 */
export type BeepKind = 'press' | 'go' | 'done';

/** [start offset, length, frequency], all seconds and hertz. */
type Tone = readonly [number, number, number];

const TONES: Record<BeepKind, readonly Tone[]> = {
  // Short, low, and one of them. A press is confirmed by something you already felt.
  press: [[0, 0.06, 620]],
  // Two rising notes. Loud and unmistakable: this is the one you act on.
  go: [[0, 0.1, 780], [0.12, 0.18, 1180]],
  // Two notes the other way round, so finishing never sounds like starting.
  done: [[0, 0.14, 1180], [0.2, 0.26, 880]],
};

/**
 * The buzz that goes with each. A gym is loud, and a phone on a rubber mat carries a vibration
 * further than it carries 880Hz. On native, where there is no oscillator here, it is the whole
 * signal - so `press` gets one too, quietly, even though your finger is already on the glass.
 */
const BUZZ: Record<BeepKind, number[]> = {
  press: [0, 35],
  go: [0, 90, 60, 90],
  done: [0, 120, 90, 200],
};

type WindowWithAudio = typeof globalThis & {
  AudioContext?: new () => AudioContext;
  webkitAudioContext?: new () => AudioContext;
};

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (ctx !== null) return ctx;
  try {
    const w = globalThis as WindowWithAudio;
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (Ctor === undefined) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Opens the audio device while a gesture is in progress. Call from the Start handler. */
export function primeBeep(): void {
  const audio = audioContext();
  if (audio === null) return;
  // Created suspended when the page has not had a gesture yet; resuming inside one sticks.
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
}

function emit(audio: AudioContext, tones: readonly Tone[]): void {
  try {
    const at = audio.currentTime;
    for (const [start, length, hz] of tones) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      /*
       * Ramped rather than switched. A gain that jumps from 0 to full and back produces a click
       * at each edge - the discontinuity is itself a broadband sound - which on a phone speaker
       * is louder and nastier than the tone it is wrapping.
       */
      gain.gain.setValueAtTime(0.0001, at + start);
      gain.gain.exponentialRampToValueAtTime(0.3, at + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + start + length);
      osc.connect(gain).connect(audio.destination);
      osc.start(at + start);
      osc.stop(at + start + length + 0.02);
    }
  } catch {
    // The buzz already fired, and a missing tone is not worth taking a screen down for.
  }
}

/**
 * Plays one of the three sounds, and buzzes.
 *
 * The context may still be suspended on the very first call - `press` fires from the same tap
 * that primed it, and resume() is a promise. Rather than drop that beep, this waits for the
 * resume and plays after it. Everything is scheduled against `currentTime` read at play time,
 * so the short delay shifts the sound rather than corrupting it.
 */
export function beep(kind: BeepKind = 'done'): void {
  try {
    Vibration.vibrate(BUZZ[kind]);
  } catch {
    // Not every device has a motor, and the web version needs a permission some browsers
    // decline. The tone is the real signal; this is the one that works face down.
  }

  const audio = audioContext();
  if (audio === null) return;

  if (audio.state === 'suspended') {
    void audio
      .resume()
      .then(() => emit(audio, TONES[kind]))
      .catch(() => undefined);
    return;
  }
  if (audio.state !== 'running') return;
  emit(audio, TONES[kind]);
}
