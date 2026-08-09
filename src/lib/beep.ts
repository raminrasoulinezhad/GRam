import { Platform, Vibration } from 'react-native';

/**
 * The sound a finished hold makes.
 *
 * Synthesised rather than played from a file. A plank is timed with the phone face down on a
 * bench, so the end of the set has to be audible without looking - but shipping an audio asset
 * to say "beep" costs a download, a licence question and a cache entry, and it is one sine
 * wave. The browser can make it.
 *
 * WHY IT HAS TO BE PRIMED
 * Browsers refuse to start audio except in response to a real user gesture, and the beep is
 * wanted a minute *after* the tap that started the timer. So the audio context is opened during
 * the tap, while permission is granted, and then kept - the beep later just writes to a context
 * that is already running. Without priming the first beep of a session is silently dropped,
 * which is the worst kind of failure here: you only find out by missing it.
 */

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

/**
 * Two short tones, because one is easy to mistake for a notification from something else.
 *
 * Also buzzes: a gym is loud, and a phone on a rubber mat carries a vibration better than it
 * carries 880Hz. On native, where there is no oscillator here, the buzz is the whole signal.
 */
export function beep(): void {
  try {
    Vibration.vibrate([0, 120, 90, 200]);
  } catch {
    // Not every device has a motor, and the web version needs a permission some browsers
    // decline. The tone below is the real signal; this is the one that works face down.
  }

  const audio = audioContext();
  if (audio === null || audio.state !== 'running') return;

  try {
    const at = audio.currentTime;
    for (const [start, length, hz] of [
      [0, 0.14, 880],
      [0.2, 0.26, 1180],
    ] as const) {
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
