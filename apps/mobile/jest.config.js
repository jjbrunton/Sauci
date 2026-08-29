/** @type {import('jest').Config} */
module.exports = {
    preset: 'jest-expo',
    clearMocks: true,
    setupFiles: [
        '<rootDir>/src/test/setupEnv.js',
        '../../node_modules/react-native-gesture-handler/jestSetup.js',
    ],
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
    collectCoverageFrom: [
        '<rootDir>/app/**/*.{ts,tsx}',
        '<rootDir>/src/**/*.{ts,tsx}',
        '!<rootDir>/src/**/__tests__/**',
        '!<rootDir>/src/test/**',
        '!<rootDir>/**/*.d.ts',
    ],
    coverageThreshold: {
        global: {
            statements: 23,
            branches: 17,
            functions: 21,
            lines: 23,
        },
    },
    transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo(nent)?/.*|expo-router|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|@sentry/react-native|@sentry/.*)',
    ],
};
