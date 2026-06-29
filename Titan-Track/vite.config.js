import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg'],
            manifest: {
                name: 'Titan Track - Workout Tracker',
                short_name: 'TitanTrack',
                description: 'Offline-first strength training tracker with deep analytics.',
                theme_color: '#1c1917',
                background_color: '#0f172a',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                icons: [
                    {
                        src: '/icons/icon.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    },
                    {
                        src: '/icons/icon-maskable.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === 'document';
                        },
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'documents'
                        }
                    },
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return ['style', 'script', 'worker'].includes(request.destination);
                        },
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'assets'
                        }
                    }
                ]
            }
        })
    ]
});
