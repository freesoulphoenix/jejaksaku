import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const appBase = '/';

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'jejaksaku-logo.svg',
        'jejaksaku-192x192.png',
        'jejaksaku-512x512.png',
        'jejaksaku-apple-touch-icon.png',
        'jejaksaku-maskable-512x512.png'
      ],
      manifest: {
        name: 'Jejak Saku',
        short_name: 'Jejak Saku',
        description: 'Personal finance, receipts, bills, and expense tracker',
        theme_color: '#2D8CFF',
        background_color: '#F5F9FD',
        display: 'standalone',
        start_url: appBase,
        scope: appBase,
        orientation: 'portrait',
        icons: [
          {
            src: `${appBase}jejaksaku-192x192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${appBase}jejaksaku-512x512.png`,
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: `${appBase}jejaksaku-maskable-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${appBase}index.html`,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: {
    port: 5173
  }
});
