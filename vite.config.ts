import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'لقطة — Luqta',
        short_name: 'لقطة',
        description:
          'Fully offline wishlist & product comparison. Share a product link, extract specs on-device, compare side by side.',
        theme_color: '#3d5a3a',
        background_color: '#e8efe4',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ar',
        dir: 'rtl',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        share_target: {
          action: './share',
          method: 'GET',
          enctype: 'application/x-www-form-urlencoded',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
          },
        },
        categories: ['shopping', 'utilities', 'productivity'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Same-origin only — never cache third-party URLs.
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
    {
      name: 'spa-github-pages-fallback',
      closeBundle() {
        const index = path.resolve(rootDir, 'dist/index.html')
        const fallback = path.resolve(rootDir, 'dist/404.html')
        if (existsSync(index)) copyFileSync(index, fallback)
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
})
