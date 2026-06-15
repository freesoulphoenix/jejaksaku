import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'dompetdaily-logo.svg',
        'dompetdaily-192x192.png',
        'dompetdaily-512x512.png',
        'dompetdaily-apple-touch-icon.png',
        'dompetdaily-maskable-512x512.png'
      ],
      manifest: {
        name: 'Dompet Daily',
        short_name: 'Dompet Daily',
        description: 'Personal finance, receipts, bills, and expense tracker',
        theme_color: '#2D8CFF',
        background_color: '#F5F9FD',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: '/dompetdaily-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/dompetdaily-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/dompetdaily-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      }
    })
  ],
  server: {
    port: 5173
  }
});
