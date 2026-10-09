import { handleCoverRequest } from '../../../shared/covers.ts'
import { handleGutenbergRequest } from '../../../shared/gutenberg.ts'
import { isCrossOrigin } from '../../../shared/http-guards.ts'
import { handleRelayRequest } from '../../../shared/relay.ts'
import { operationMetric } from '../../../shared/telemetry.ts'

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' blob:; " +
  "img-src 'self' data: blob: https://www.gutenberg.org; font-src 'self' data: blob:; " +
  "connect-src 'self' https://api.openai.com; " +
  "frame-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'self'"

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'no-referrer')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function apiError(status: number, message: string): Response {
  return Response.json({ error: { message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Serves repeat Gutenberg searches from the edge cache, so a query anyone ran
 * recently never waits on upstream. Downloads are left alone: they are large
 * and rarely repeat. Cross-origin requests skip the cache so the relay's own
 * check still turns them away.
 */
async function gutenbergWithCache(request: Request, ctx: ExecutionContext): Promise<Response> {
  const relay = () =>
    handleGutenbergRequest(request, { ip: request.headers.get('CF-Connecting-IP') ?? '' })
  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim().toLowerCase()
  if (request.method !== 'GET' || !search || isCrossOrigin(request)) return relay()

  const key = new Request(`${url.origin}/api/gutenberg?search=${encodeURIComponent(search)}`)
  const cache = await caches.open('gutenberg-search')
  const cached = await cache.match(key)
  if (cached) return cached

  const response = await relay()
  if (response.ok) ctx.waitUntil(cache.put(key, response.clone()))
  return response
}

/**
 * Serves repeat cover searches and images from the edge cache. A cover id
 * always names the same image, and opening the picker for a book fetches the
 * same handful of thumbnails every time.
 */
async function coversWithCache(request: Request, ctx: ExecutionContext): Promise<Response> {
  const relay = () =>
    handleCoverRequest(request, { ip: request.headers.get('CF-Connecting-IP') ?? '' })
  const url = new URL(request.url)
  if (request.method !== 'GET' || isCrossOrigin(request)) return relay()

  // Rebuilt from the known parameters only, so junk ones cannot fan out the cache.
  const key = new URL('/api/covers', url.origin)
  for (const name of ['title', 'author', 'id', 'size']) {
    const value = url.searchParams.get(name)?.trim().toLowerCase()
    if (value) key.searchParams.set(name, value)
  }
  const cache = await caches.open('covers')
  const cached = await cache.match(key)
  if (cached) return cached

  const response = await relay()
  if (response.ok) ctx.waitUntil(cache.put(key, response.clone()))
  return response
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const started = performance.now()

    try {
      if (url.pathname === '/health') {
        return Response.json(
          { status: 'ok', service: 'app' },
          {
            headers: { 'Cache-Control': 'no-store' },
          },
        )
      }
      if (url.pathname === '/api/chat') {
        return await handleRelayRequest(
          request,
          {
            apiKey: env.OPENROUTER_API_KEY,
            siteUrl: url.origin,
            enabled: env.CHAT_ENABLED !== 'false',
          },
          { ip: request.headers.get('CF-Connecting-IP') ?? '' },
        )
      }

      if (url.pathname === '/api/gutenberg') {
        return await gutenbergWithCache(request, ctx)
      }

      if (url.pathname === '/api/covers') {
        return await coversWithCache(request, ctx)
      }

      if (url.pathname.startsWith('/api/')) {
        return apiError(404, 'API route not found.')
      }

      return withSecurityHeaders(await env.ASSETS.fetch(request))
    } catch {
      console.error(JSON.stringify(operationMetric('app', 500, performance.now() - started)))

      return url.pathname.startsWith('/api/')
        ? apiError(500, 'Internal server error.')
        : withSecurityHeaders(new Response('Internal server error.', { status: 500 }))
    }
  },
} satisfies ExportedHandler<Env>

export default worker
