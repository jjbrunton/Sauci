/// <reference types="jest" />

// Some modules rely on this global existing in RN.
(global as any).__DEV__ = true;

if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
}

if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
}

if (!process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID) {
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID = 'pro';
}

jest.mock('@supabase/supabase-js', () => {
    const makeChannel = () => {
        const channel: any = {
            on: jest.fn(() => channel),
            subscribe: jest.fn(() => channel),
            send: jest.fn(async () => ({ data: null, error: null })),
        };
        return channel;
    };

    return {
        createClient: jest.fn(() => ({
            auth: {
                getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
                getUser: jest.fn(async () => ({ data: { user: null }, error: null })),
                signOut: jest.fn(async () => ({ error: null })),
            },
            from: jest.fn(() => ({
                select: jest.fn(),
                eq: jest.fn(),
                neq: jest.fn(),
                is: jest.fn(),
                in: jest.fn(),
                order: jest.fn(),
                range: jest.fn(),
                update: jest.fn(),
                upsert: jest.fn(),
                insert: jest.fn(),
                maybeSingle: jest.fn(),
            })),
            channel: jest.fn(() => makeChannel()),
            removeChannel: jest.fn(),
            storage: {
                from: jest.fn(() => ({
                    upload: jest.fn(async () => ({ data: null, error: null })),
                    createSignedUrl: jest.fn(async () => ({ data: { signedUrl: 'https://example.com' }, error: null })),
                })),
            },
            functions: {
                invoke: jest.fn(async () => ({ data: null, error: null })),
            },
        })),
    };
});

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Reanimated = require('react-native-reanimated/mock');

    // The mock is missing `call` in some versions.
    Reanimated.default.call = () => {};

    return Reanimated;
});

// Reanimated 3 sometimes requires this when running in Jest.
// eslint-disable-next-line no-undef
(global as any).__reanimatedWorkletInit = () => {};

jest.mock('expo-linear-gradient', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { View } = require('react-native');

    return {
        LinearGradient: ({ children, ...props }: any) => React.createElement(View, props, children),
    };
});

jest.mock('@expo/vector-icons', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Text } = require('react-native');

    const Icon = ({ name, ...props }: any) => React.createElement(Text, props, name);

    return { Ionicons: Icon };
});

jest.mock('@react-native-async-storage/async-storage', () =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
    launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
    MediaTypeOptions: {
        All: 'All',
        Videos: 'Videos',
    },
}));

jest.mock('expo-file-system', () => ({
    readAsStringAsync: jest.fn(async () => ''),
    EncodingType: {
        Base64: 'base64',
    },
}));

jest.mock('react-native-compressor', () => ({
    Video: {
        compress: jest.fn(async (uri: string) => uri),
    },
}));

jest.mock('base64-arraybuffer', () => ({
    decode: jest.fn(() => new ArrayBuffer(0)),
}));

jest.mock('posthog-react-native', () => {
    return class PostHog {
        capture = jest.fn();
        identify = jest.fn();
        reset = jest.fn();
        screen = jest.fn();
        flush = jest.fn();

        constructor() {
            // no-op
        }
    };
});
