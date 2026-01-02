import React, { PropsWithChildren } from 'react';
import {
    render as rtlRender,
    RenderOptions,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

export function TestProviders({ children }: PropsWithChildren) {
    const queryClient = createTestQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function render(ui: React.ReactElement, options?: RenderOptions) {
    return rtlRender(ui, { wrapper: TestProviders, ...options });
}

export * from '@testing-library/react-native';
