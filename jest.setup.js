/* eslint-env jest */

// AsyncStorage has no native module under jest; the official in-memory mock stands in for it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/*
 * Same situation for the safe-area insets: the real provider needs a native module (or, on
 * web, a real DOM to measure env() paddings in), and neither exists under jest. The library's
 * own mock keeps the context plumbing real and reports zero insets by default, so components
 * using useSafeAreaInsets render as they do in a plain browser tab. A test that wants a notch
 * wraps its render in <SafeAreaProvider initialMetrics={...}>.
 */
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
