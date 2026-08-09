import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useStore } from '@/store/useStore';
import { theme } from './theme';
import { isThemeReload } from './themeReload';

/** How long the logo stays up once everything is ready. */
const MINIMUM_MS = 1800;
const FADE_MS = 320;

/**
 * Brand screen shown while the app starts.
 *
 * It is not only decoration. The persisted store rehydrates from AsyncStorage asynchronously,
 * so without something covering that gap the app paints "No plans yet" for a frame and then
 * snaps to your real data. The splash holds until the store has actually loaded, then stays a
 * moment longer so it reads as intentional rather than as a flash.
 *
 * EXCEPT AFTER A THEME CHANGE
 * That restart is not a launch - the user tapped a colour two seconds ago and is still on the
 * page they tapped it from. Playing the logo there turns a setting into an event, and holding
 * it for the full MINIMUM_MS makes changing your mind about a colour cost two seconds a go.
 *
 * The cover still appears, because the hydration gap is just as real on that path; it is
 * simply the background colour with nothing on it, and it lifts the moment the store is ready
 * rather than waiting out the brand delay. The result reads as a repaint, not a relaunch.
 */
export function Splash({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const { width, height } = useWindowDimensions();
  const quiet = isThemeReload();

  // Two versions of the artwork: a tall one that fills a phone, a wide one for a landscape
  // window. Using the wide logo on a phone would leave it stranded in a band of empty space.
  const portrait = height >= width;

  useEffect(() => {
    let cancelled = false;
    let faded = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const hide = () => {
      if (cancelled || faded) return;
      faded = true;
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        // react-native-web does not drive opacity natively, and asking it to leaves the
        // overlay stuck fully opaque on top of the app - which is every bit as bad as it
        // sounds. Native platforms still get the native driver.
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        if (!cancelled) setDone(true);
      });
      // The animation callback is the normal path; this guarantees the overlay is removed
      // even if it never fires, because nothing is worth trapping the user behind a logo.
      timers.push(setTimeout(() => !cancelled && setDone(true), FADE_MS + 250));
    };

    // No brand delay on a theme change: the cover is there to hide the hydration gap, and the
    // moment that closes there is nothing left to hide.
    const linger = quiet ? 0 : MINIMUM_MS;

    const startFade = () => {
      if (cancelled) return;
      timers.push(setTimeout(hide, linger));
    };

    // hasHydrated() is already true when storage resolved before this mounted, in which case
    // onFinishHydration would never fire.
    let unsub: (() => void) | undefined;
    if (useStore.persist.hasHydrated()) startFade();
    else unsub = useStore.persist.onFinishHydration(startFade);

    // Backstop: a storage failure must not strand anyone on the splash forever.
    timers.push(setTimeout(hide, linger + 3000));

    return () => {
      cancelled = true;
      unsub?.();
      for (const t of timers) clearTimeout(t);
    };
  }, [opacity, quiet]);

  return (
    <View style={s.root}>
      {children}
      {!done ? (
        <Animated.View
          style={[s.overlay, { opacity }]}
          pointerEvents="none"
          testID={quiet ? 'splash-quiet' : 'splash'}
        >
          {quiet ? null : (
            <Image
              source={
                portrait
                  ? require('../../assets/logo-portrait.jpg')
                  : require('../../assets/logo.jpg')
              }
              style={s.image}
              resizeMode="cover"
              accessibilityLabel="GRam"
            />
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Full-bleed: the artwork is a scene, not a logo on a flat colour, so it fills the screen.
  image: { width: '100%', height: '100%' },
});
