import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    optimizeDeps: {
        include: ['react-icons/io5'],
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-icons': ['react-icons/io5'],
                },
            },
        },
    },
    server: {
        host: true,
        port: 3001,
        allowedHosts: ['manage.sauci.app'],
        // The API has no CORS handling, so local development serves API calls
        // same-origin and forwards them to the local API process.
        proxy: {
            '/v1': {
                target: process.env.SAUCI_ADMIN_API_PROXY ?? 'http://127.0.0.1:3003',
                changeOrigin: true,
            },
        },
        watch: {
            usePolling: true,
            interval: 100,
        },
    },
});
