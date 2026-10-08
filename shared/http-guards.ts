/**
 * Request guards shared by the relays in this directory. Every endpoint is
 * open to every visitor and each spends something the site pays for: inference
 * credit for `/api/chat`, bandwidth for `/api/gutenberg` and `/api/covers`. So
 * all of them need the same speed bumps. Written against Web APIs only, like the relays themselves.
 */

/**
 * Rejects browser requests that came from another site. `Origin` catches normal
 * cross-origin fetches, while Fetch Metadata closes the gap left by `no-cors`
 * GETs such as image hotlinks, where browsers may omit `Origin` entirely.
 *
 * A request with neither header still passes deliberately: non-browser clients
 * do not send Fetch Metadata and may omit Origin. The KOReader plugin in
 * `koreader/` is one such client, and asking a question from an e-reader goes
 * through the chat relay. Those requests identify themselves with
 * `X-Marginalia-Client` if they ever need throttling separately.
 *
 * These headers are still only a speed bump — a determined non-browser caller
 * can forge or omit them — so the relays also keep their per-IP throttles.
 */
export function isCrossOrigin(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true

  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin !== new URL(request.url).origin
  } catch {
    return true
  }
}

export interface RateLimit {
  windowMs: number
  maxRequests: number
}

/**
 * Sliding window kept in isolate memory. Edge isolates are per-region and
 * short-lived, so this trims obvious hammering rather than enforcing a global
 * quota — treat it as a speed bump, not a budget.
 *
 * Each endpoint gets its own limiter, so a reader searching Gutenberg never
 * spends the budget for asking a question.
 */
export function createRateLimiter({ windowMs, maxRequests }: RateLimit): (ip: string) => boolean {
  const hits = new Map<string, number[]>()

  return function rateLimited(ip: string): boolean {
    if (!ip) return false
    const now = Date.now()
    const recent = (hits.get(ip) ?? []).filter((at) => now - at < windowMs)
    recent.push(now)
    hits.set(ip, recent.slice(-maxRequests - 1))

    if (hits.size > 5000) {
      for (const [key, times] of hits) {
        if (times.every((at) => now - at >= windowMs)) hits.delete(key)
      }
    }

    return recent.length > maxRequests
  }
}

/**
 * How long an upstream attempt may spend waiting for response headers. Cleared
 * as soon as they land, so this bounds how long upstream may take to start a
 * download, not how long the download itself may run. Without it a stalled
 * upstream burns the whole edge-function time budget and the platform answers
 * with an opaque 502 instead of the JSON error the client knows how to show.
 */
const UPSTREAM_BUDGET_MS = 20_000

/**
 * Fetches upstream under a deadline and never rejects, so an unreachable host
 * stays a value the relay can turn into a JSON error. An escaping rejection
 * is what the platform turns into a bare 502, and in dev it leaves the Vite
 * middleware with no response to write, so the request simply hangs.
 *
 * Returns `undefined` when the attempt failed or timed out.
 */
export async function fetchUpstream(
  fetcher: typeof fetch,
  input: string | URL,
  init: RequestInit,
): Promise<Response | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_BUDGET_MS)

  try {
    return await fetcher(input, { ...init, signal: controller.signal })
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/** A JSON answer, uncached: relay errors must never be served from a cache. */
export function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
