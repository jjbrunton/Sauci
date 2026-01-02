/** @type {import('jest').Config} */
module.exports = {
    preset: 'jest-expo',
    clearMocks: true,
    setupFiles: ['<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js'],
    setupFilesAfterEnv: [
        '@testing-library/jest-native/extend-expect',
        '<rootDir>/src/test/setup.ts',
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testMatch: [
        '<rootDir>/src/**/__tests__/**/*.(spec|test).(ts|tsx)',
        '<rootDir>/src/**/*.(spec|test).(ts|tsx)',
    ],
    transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-router|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|@sentry/react-native|@sentry/.*)',
    ],
};
