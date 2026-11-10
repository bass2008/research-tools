module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@/content/(.*)$': '<rootDir>/../web/content/$1',
    '^@/lib/(.*)$': '<rootDir>/../web/lib/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
  },
  transformIgnorePatterns: ['node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo.*|@expo(nent)?/.*|@react-navigation/.*|react-native-svg|react-native-view-shot|react-native-android-widget)/)'],
};
