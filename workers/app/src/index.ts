import { handleRelayRequest } from '../../../shared/relay.ts'
import * as Sentry from '@sentry/cloudflare'
import { operationMetric, sanitizeErrorEvent } from '../../../shared/telemetry.ts'

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' blob:; " +
  "img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' " +
  'https://api.openai.com https://marginalia-audiobooks.cloudflare-cdd.workers.dev ' +
  'https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io ' +
  'https://us.i.posthog.com https://eu.i.posthog.com; ' +
  "media-src 'self' blob: https://marginalia-audiobooks.cloudflare-cdd.workers.dev; " +
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

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
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

      if (url.pathname.startsWith('/api/')) {
        return apiError(404, 'API route not found.')
      }

      return withSecurityHeaders(await env.ASSETS.fetch(request))
    } catch {
      Sentry.captureException(new Error('Application operation failed'))
      console.error(JSON.stringify(operationMetric('app', 500, performance.now() - started)))

      return url.pathname.startsWith('/api/')
        ? apiError(500, 'Internal server error.')
        : withSecurityHeaders(new Response('Internal server error.', { status: 500 }))
    }
  },
} satisfies ExportedHandler<Env>

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN || undefined,
    enabled: Boolean(env.SENTRY_DSN),
    defaultIntegrations: false,
    tracesSampleRate: 0,
    beforeSend: sanitizeErrorEvent,
  }),
  worker,
)
