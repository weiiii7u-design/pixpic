import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { segmentationPlugin } from './server/segmentation-plugin';

export default defineConfig({
  base: '/pixpic/',
  server: { host: true, port: 5174 },
  plugins: [
    segmentationPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'stickers/**/*', 'showcase/**/*'],
      manifest: {
        name: 'pixpic',
        short_name: 'pixpic',
        description: '点阵风格图片编辑器',
        theme_color: '#0B0B0B',
        background_color: '#F5F3EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/pixpic/',
        icons: [
          { src: '/pixpic/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pixpic/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pixpic/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ['showcase/**/*'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'cdn-cache', expiration: { maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['@imgly/background-removal']
  }
});
