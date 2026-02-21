import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: 'src',
    envDir: '..',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/www\.googleapis\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'youtube-api',
                            networkTimeoutSeconds: 5,
                            expiration: { maxEntries: 50, maxAgeSeconds: 300 },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'cdn-assets',
                            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/.*\.ytimg\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'thumbnails',
                            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\..*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                ],
            },
            manifest: {
                name: 'MelodyStream',
                short_name: 'MelodyStream',
                description: 'Ücretsiz ve Reklamsız Müzik Dinleme Uygulaması',
                start_url: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#0A0A0F',
                theme_color: '#7C3AED',
                categories: ['music', 'entertainment'],
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
        }),
    ],
    server: {
        port: 3000,
        open: true,
        proxy: {
            // Proxy /api/* to Netlify Functions running via `netlify dev`
            '/api': {
                target: 'http://localhost:9999',
                changeOrigin: true,
                rewrite: (path) => path.replace('/api', '/.netlify/functions')
            }
        }
    },
});
