import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { Readable } from 'node:stream'
import { handleRelayRequest } from './shared/relay.ts'
import { handleGutenbergRequest } from './shared/gutenberg.ts'
import { handleCoverRequest } from './shared/covers.ts'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * Serves /api/chat in dev with the same handler the Cloudflare Worker uses,
 * so local runs exercise the real relay instead of a stand-in. Reads
 * OPENROUTER_API_KEY from .env.local; the deployed Worker has it as a secret.
 */
function chatRelay(apiKey: string, enabled: boolean): Plugin {
  return {
    name: 'marginalia-chat-relay',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        const chunks: Buffer[] = []
        let bytes = 0
        for await (const chunk of req) {
          bytes += (chunk as Buffer).length
          if (bytes > 600_000) {
            res.statusCode = 413
            res.end('Request body too large.')
            return
          }
          chunks.push(chunk as Buffer)
        }

        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(name, value)
        }

        const origin = `http://${req.headers.host ?? 'localhost'}`
        const request = new Request(new URL('/api/chat', origin), {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        })

        const response = await handleRelayRequest(
          request,
          { apiKey, siteUrl: origin, enabled },
          { ip: req.socket.remoteAddress ?? '' },
        )

        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        if (response.body) {
          Readable.fromWeb(response.body).pipe(res)
        } else {
          res.end()
        }
      })
    },
  }
}

/**
 * Serves a GET-only relay in dev with its production handler, URL validation
 * included. Used for the Gutenberg catalog and the cover search.
 */
function getRelay(
  path: string,
  handle: (request: Request, options: { ip: string }) => Promise<Response>,
): Plugin {
  return {
    name: `marginalia-relay${path.replaceAll('/', '-')}`,
    configureServer(server) {
      server.middlewares.use(path, async (req, res) => {
        const origin = `http://${req.headers.host ?? 'localhost'}`
        const requestUrl = new URL(req.url ?? '', new URL(path, origin))
        requestUrl.pathname = path

        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(name, value)
        }

        const response = await handle(new Request(requestUrl, { method: req.method, headers }), {
          ip: req.socket.remoteAddress ?? '',
        })

        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        if (response.body) Readable.fromWeb(response.body).pipe(res)
        else res.end()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const remoteRelay = env.CHAT_RELAY_URL?.trim()

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(remoteRelay
        ? []
        : [chatRelay(env.OPENROUTER_API_KEY ?? '', env.CHAT_ENABLED !== 'false')]),
      getRelay('/api/gutenberg', handleGutenbergRequest),
      getRelay('/api/covers', handleCoverRequest),
      visualizer({
        filename: 'reports/bundle.html',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Rami',
          short_name: 'Rami',
          description:
            'Follow a book beyond the page: select a passage and see where your questions lead.',
          theme_color: '#f4ecda',
          background_color: '#f4ecda',
          display: 'standalone',
          start_url: '/',
          // Lets the reader share a Gutenberg book page straight out of their
          // browser into Rami instead of copying the link across. Android
          // share sheets vary in which field they fill, so /add reads them all.
          share_target: {
            action: '/add',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
          },
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Books live in IndexedDB, not the SW cache, so the precache stays
          // small — including the sample EPUB, which is fetched once on first run.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Relays must never be served from the SPA fallback or a cache.
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    // epub.js references `global` in a few places.
    define: { global: 'globalThis' },
    build: { chunkSizeWarningLimit: 450 },
    server: {
      host: '127.0.0.1',
      // Forward chat to a deployed relay instead of using a local key. The relay
      // rejects cross-origin browsers, so drop Origin like a non-browser client.
      proxy: remoteRelay
        ? {
            '/api/chat': {
              target: remoteRelay,
              changeOrigin: true,
              configure: (proxy) => {
                proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
              },
            },
          }
        : undefined,
    },
  }
})
