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
        watch: {
            usePolling: true,
            interval: 100,
        },
    },
});
