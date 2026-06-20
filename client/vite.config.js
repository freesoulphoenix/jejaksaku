import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const appBase = isGitHubPages ? '/dompetdaily/' : '/';

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'jejakdana-logo.svg',
        'jejakdana-192x192.png',
        'jejakdana-512x512.png',
        'jejakdana-apple-touch-icon.png',
        'jejakdana-maskable-512x512.png'
      ],
      manifest: {
        name: 'Jejak Dana',
        short_name: 'Jejak Dana',
        description: 'Personal finance, receipts, bills, and expense tracker',
        theme_color: '#2D8CFF',
        background_color: '#F5F9FD',
        display: 'standalone',
        start_url: appBase,
        scope: appBase,
        orientation: 'portrait',
        icons: [
          {
            src: `${appBase}jejakdana-192x192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${appBase}jejakdana-512x512.png`,
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: `${appBase}jejakdana-maskable-512x512.png`,
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
