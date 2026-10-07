import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

const ORIGIN = 'http://127.0.0.1:5173'
let mf: Miniflare
let signedUrl: string
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      scriptPath: 'workers/audiobooks/reports/audiobooks-build/index.js',
      compatibilityDate: '2026-08-23',
      compatibilityFlags: ['nodejs_compat'],
      r2Buckets: ['AUDIOBOOKS'],
      ratelimits: {
        SESSION_RATE_LIMITER: { namespace_id: '140015', simple: { limit: 30, period: 60 } },
      },
      bindings: {
        ALLOWED_ORIGINS: ORIGIN,
        SIGNED_URL_TTL_SECONDS: '600',
        ACCESS_TOKEN: 'synthetic-local-only',
        SIGNING_KEY: 'synthetic-local-only-signing-key',
        SENTRY_DSN: '',
      },
    }),
  )
  const bucket = await mf.getR2Bucket('AUDIOBOOKS')
  await bucket.put('twilight-of-the-idols/audiobook.opus', '0123456789', {
    httpMetadata: { contentType: 'audio/ogg' },
  })
  const session = await mf.dispatchFetch('http://worker.test/session', {
    method: 'POST',
    headers: { Origin: ORIGIN, Authorization: 'Bearer synthetic-local-only' },
  })
  expect(session.status).toBe(200)
  const body = (await session.json()) as { audioUrl: string }
  signedUrl = body.audioUrl
})
afterAll(async () => {
  await mf?.dispose()
})

describe('audiobook Worker, real local R2 and crypto', () => {
  it('provides a non-sensitive health endpoint', async () => {
    const response = await mf.dispatchFetch('http://worker.test/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', service: 'audiobooks' })
  })
  it('rejects missing origin and wrong credentials', async () => {
    expect((await mf.dispatchFetch('http://worker.test/session', { method: 'POST' })).status).toBe(
      403,
    )
    expect(
      (
        await mf.dispatchFetch('http://worker.test/session', {
          method: 'POST',
          headers: { Origin: ORIGIN, Authorization: 'Bearer wrong' },
        })
      ).status,
    ).toBe(401)
  })
  it('rejects unapproved browser origins', async () => {
    expect(
      (await mf.dispatchFetch(signedUrl, { headers: { Origin: 'https://evil.test' } })).status,
    ).toBe(403)
  })
  it('streams only allowlisted signed objects', async () => {
    const response = await mf.dispatchFetch(signedUrl)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('0123456789')
    expect(response.headers.get('Content-Type')).toBe('audio/ogg')
    const other = new URL(signedUrl)
    other.pathname = '/objects/private.opus'
    expect((await mf.dispatchFetch(other)).status).toBe(404)
  })
  it('rejects signature tampering and expiration', async () => {
    const url = new URL(signedUrl)
    url.searchParams.set('signature', 'forged')
    expect((await mf.dispatchFetch(url)).status).toBe(401)
    url.searchParams.set('expires', '1')
    expect((await mf.dispatchFetch(url)).status).toBe(401)
  })
  it.each([
    ['bytes=2-4', '234'],
    ['bytes=8-', '89'],
    ['bytes=-3', '789'],
  ])('supports valid range %s', async (range, expected) => {
    const response = await mf.dispatchFetch(signedUrl, { headers: { Range: range } })
    expect(response.status).toBe(206)
    expect(await response.text()).toBe(expected)
    expect(response.headers.get('Content-Range')).toMatch(/\/10$/)
  })
  it.each(['bytes=10-', 'bytes=-0', 'bytes=5-2', 'bytes=0-1,4-5'])(
    'rejects invalid range %s',
    async (range) => {
      const response = await mf.dispatchFetch(signedUrl, { headers: { Range: range } })
      expect(response.status).toBe(416)
      expect(response.headers.get('Content-Range')).toBe('bytes */10')
    },
  )
  it('handles HEAD and preflight without returning audio', async () => {
    const head = await mf.dispatchFetch(signedUrl, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    const options = await mf.dispatchFetch(signedUrl, {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN },
    })
    expect(options.status).toBe(204)
    expect(options.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
  })
  it('rejects unsupported object methods', async () => {
    expect((await mf.dispatchFetch(signedUrl, { method: 'POST' })).status).toBe(405)
  })
})
