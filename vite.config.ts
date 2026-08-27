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
          'Local-first AI wishlist & product comparison. Share a product link, extract specs in-browser, compare side by side.',
        theme_color: '#2f4a32',
        background_color: '#e7e3d6',
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
        globPatterns: [
          '**/*.{css,html,ico,svg,woff2}',
          'assets/index-*.js',
        ],
        globIgnores: ['**/lib-*.js'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/lib-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'luqta-webllm',
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    {
      name: 'luqta-page-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/__luqta_proxy')) {
            next()
            return
          }
          try {
            const incoming = new URL(req.url, 'http://127.0.0.1')
            const target = incoming.searchParams.get('url')
            if (!target || !/^https?:\/\//i.test(target)) {
              res.statusCode = 400
              res.end('Missing or invalid url')
              return
            }
            const upstream = await fetch(target, {
              redirect: 'follow',
              headers: {
                Accept: 'text/html,application/xhtml+xml',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              },
            })
            const html = await upstream.text()
            res.statusCode = upstream.ok ? 200 : upstream.status
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(html)
          } catch (err) {
            res.statusCode = 502
            res.end(err instanceof Error ? err.message : 'Proxy fetch failed')
          }
        })
      },
    },
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
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  build: {
    chunkSizeWarningLimit: 3500,
  },
})
