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
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/catalog/generated.ts',
    '!src/**/__tests__/**',
  ],
};
