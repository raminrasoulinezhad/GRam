/* eslint-env jest */

// AsyncStorage has no native module under jest; the official in-memory mock stands in for it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
