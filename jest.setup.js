/* eslint-env jest */

// AsyncStorage has no native module under jest; the official in-memory mock stands in for it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Alert.alert is fire-and-forget in RN. Tests that exercise a confirm flow invoke the
// destructive button directly via this spy rather than trying to drive a native dialog.
jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
