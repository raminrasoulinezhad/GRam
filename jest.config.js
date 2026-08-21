/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  /*
   * `standard-navigation` is expo-router's own dependency and ships untranspiled ESM, so any
   * test that renders a component importing `router` - without mocking expo-router first - dies
   * on "Cannot use import statement outside a module" from inside node_modules. It is in the
   * list for the same reason every other name here is: it is a dependency we do not control and
   * do not ship pre-compiled.
   */
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-body-highlighter)',
  ],
  /*
   * 5 seconds is Jest's default and it is not enough here on a cold cache. A clean checkout or
   * a CI runner transforms 68 suites at once, and the first render inside a suite then waits
   * behind that work: 22 tests time out, all of them passing on the next run. The failures were
   * pure scheduling noise, which is worse than a slow suite because it teaches you to rerun and
   * shrug. Warm, the whole suite still finishes in about 7 seconds.
   */
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/catalog/generated.ts',
    '!src/**/__tests__/**',
  ],
};
