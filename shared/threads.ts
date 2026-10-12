/**
 * Published threads: a snapshot of one conversation a reader chose to share,
 * stored under an unguessable id and served read-only at `/t/<id>`. See
 * `docs/decisions/0006-public-thread-links.md`.
 *
 * Shared by the Cloudflare app Worker (Workers KV) and the Vite dev server (an
 * in-memory map), so it is written against Web APIs only and takes its store
 * as a parameter.
 */

import { createRateLimiter, fetchUpstream, isCrossOrigin, json } from './http-guards.ts'
import { boundedText } from './resilience.ts'
import { operationMetric } from './telemetry.ts'

/** A link lives for a year after its last publish. */
export const THREAD_TTL_SECONDS = 365 * 24 * 60 * 60

const MAX_BODY_BYTES = 64 * 1024
const MAX_MESSAGES = 200
/** Keeps a link from republishing long stretches of an imported book. */
const MAX_PASSAGE_CHARS = 2_000
const MAX_LABEL_CHARS = 300

const ID_BYTES = 16
const TOKEN_BYTES = 32
const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Publishing is rare; a burst beyond this is not a reader. */
const rateLimited = createRateLimiter({ windowMs: 10 * 60_000, maxRequests: 10 })

interface ThreadMessage {
  role: 'user' | 'assistant'
  content: string
}

/** What a reader publishes. Nothing else from the device is sent. */
interface ThreadSnapshot {
  book: { title: string; author: string }
  chapter?: string
  passage?: string
  messages: ThreadMessage[]
}

export interface StoredThread {
  thread: ThreadSnapshot
  /** SHA-256 of the owner token, hex. The token itself is never stored. */
  ownerHash: string
  publishedAt: number
}

/** The subset of Workers KV this needs. */
export interface ThreadStore {
  get(id: string): Promise<string | null>
  put(id: string, value: string, ttlSeconds: number): Promise<void>
  delete(id: string): Promise<void>
}

export interface ThreadsOptions {
  /** Absent when the deployment has no storage bound. */
  store?: ThreadStore
  turnstileSecret?: string
  /** Public; handed to the PWA so it can render the challenge. */
  turnstileSiteKey?: string
  enabled?: boolean
  fetcher?: typeof fetch
  now?: () => number
}

export interface ThreadsRequestContext {
  /** Client address, used for throttling and passed to Turnstile. */
  ip: string
}

/** The dev server's and tests' stand-in for Workers KV, expiry included. */
export function memoryThreadStore(): ThreadStore & { size(): number } {
  const items = new Map<string, { value: string; expiresAt: number }>()
  return {
    async get(id) {
      const item = items.get(id)
      if (!item || item.expiresAt <= Date.now()) return null
      return item.value
    },
    async put(id, value, ttlSeconds) {
      items.set(id, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
    },
    async delete(id) {
      items.delete(id)
    },
    size: () => items.size,
  }
}

export async function handleThreadsRequest(
  request: Request,
  options: ThreadsOptions,
  context: ThreadsRequestContext,
): Promise<Response> {
  const started = performance.now()
  const response = await route(request, options, context)
  console.info(
    JSON.stringify(operationMetric('threads', response.status, performance.now() - started)),
  )
  return response
}

/** Reads a published thread for the viewer page, or `null` when it is gone. */
export async function loadThread(
  store: ThreadStore | undefined,
  id: string,
): Promise<StoredThread | null> {
  if (!store || !ID_PATTERN.test(id)) return null
  const raw = await store.get(id)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredThread
  } catch {
    return null
  }
}

async function route(
  request: Request,
  options: ThreadsOptions,
  { ip }: ThreadsRequestContext,
): Promise<Response> {
  const { store, enabled = true, turnstileSecret, turnstileSiteKey } = options
  const unavailable = () =>
    errorResponse(503, 'Publishing threads is not available on this deployment.')
  if (!store) return unavailable()
  if (isCrossOrigin(request)) {
    return errorResponse(403, 'Cross-origin requests are not allowed.')
  }

  const id = new URL(request.url).pathname.replace(/^\/api\/threads\/?/, '')
  // Owners can still remove their links while publishing is switched off.
  if (request.method === 'DELETE' && ID_PATTERN.test(id)) return remove(request, store, id)
  if (!enabled || !turnstileSecret?.trim() || !turnstileSiteKey?.trim()) return unavailable()

  if (!id) {
    if (request.method === 'GET') return json({ siteKey: turnstileSiteKey.trim() })
    if (request.method === 'POST') return create(request, options, store, ip)
    return errorResponse(405, 'Use GET or POST.')
  }
  if (!ID_PATTERN.test(id)) return errorResponse(404, 'No such thread.')
  if (request.method === 'PUT') return update(request, options, store, id, ip)
  if (request.method === 'DELETE') return remove(request, store, id)
  return errorResponse(405, 'Use PUT or DELETE.')
}

async function create(
  request: Request,
  options: ThreadsOptions,
  store: ThreadStore,
  ip: string,
): Promise<Response> {
  if (rateLimited(ip)) return errorResponse(429, 'Too many links published. Try again later.')

  const body = await readBody(request)
  if ('error' in body) return errorResponse(400, body.error)
  const { thread, turnstileToken } = body

  const human = await verifyTurnstile(options, turnstileToken, ip)
  if (!human) return errorResponse(403, 'The verification check did not pass. Try again.')

  const id = randomToken(ID_BYTES)
  const ownerToken = randomToken(TOKEN_BYTES)
  const publishedAt = now(options)
  const stored: StoredThread = { thread, ownerHash: await sha256(ownerToken), publishedAt }
  await store.put(id, JSON.stringify(stored), THREAD_TTL_SECONDS)

  return json(
    { id, url: threadUrl(request, id), ownerToken, expiresAt: expiresAt(publishedAt) },
    201,
  )
}

async function update(
  request: Request,
  options: ThreadsOptions,
  store: ThreadStore,
  id: string,
  ip: string,
): Promise<Response> {
  if (rateLimited(ip)) return errorResponse(429, 'Too many updates. Try again later.')

  const existing = await authorize(request, store, id)
  if (existing instanceof Response) return existing

  const body = await readBody(request)
  if ('error' in body) return errorResponse(400, body.error)

  const publishedAt = now(options)
  const stored: StoredThread = { ...existing, thread: body.thread, publishedAt }
  await store.put(id, JSON.stringify(stored), THREAD_TTL_SECONDS)
  return json({ id, url: threadUrl(request, id), expiresAt: expiresAt(publishedAt) })
}

async function remove(request: Request, store: ThreadStore, id: string): Promise<Response> {
  const existing = await authorize(request, store, id)
  if (existing instanceof Response) return existing
  await store.delete(id)
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

/** The stored thread when the bearer token owns it, otherwise the error to send. */
async function authorize(
  request: Request,
  store: ThreadStore,
  id: string,
): Promise<StoredThread | Response> {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token) return errorResponse(401, 'Missing owner token.')

  const existing = await loadThread(store, id)
  // Same answer for a wrong token and a missing thread, so ids cannot be probed.
  if (!existing || !sameHex(existing.ownerHash, await sha256(token))) {
    return errorResponse(404, 'No such thread.')
  }
  return existing
}

type ParsedBody = { thread: ThreadSnapshot; turnstileToken: string } | { error: string }

async function readBody(request: Request): Promise<ParsedBody> {
  let payload: unknown
  try {
    payload = JSON.parse(await boundedText(request, MAX_BODY_BYTES))
  } catch {
    return { error: `Expected a JSON body under ${MAX_BODY_BYTES / 1024} KB.` }
  }
  return parseBody(payload)
}

/** Validates untrusted input field by field and keeps only what is listed. */
export function parseBody(payload: unknown): ParsedBody {
  if (!isRecord(payload) || !isRecord(payload.thread)) return { error: 'Missing thread.' }
  const { book, chapter, passage, messages } = payload.thread
  const turnstileToken = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : ''

  if (!isRecord(book) || !isText(book.title, MAX_LABEL_CHARS) || !book.title.trim()) {
    return { error: 'The thread needs a book title.' }
  }
  if (!isText(book.author, MAX_LABEL_CHARS)) return { error: 'Invalid author.' }
  if (chapter !== undefined && !isText(chapter, MAX_LABEL_CHARS)) {
    return { error: 'Invalid chapter.' }
  }
  if (passage !== undefined && !isText(passage, MAX_PASSAGE_CHARS)) {
    return { error: `The passage is limited to ${MAX_PASSAGE_CHARS} characters.` }
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { error: `A thread needs between 1 and ${MAX_MESSAGES} messages.` }
  }

  const kept: ThreadMessage[] = []
  for (const message of messages) {
    if (
      !isRecord(message) ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string'
    ) {
      return { error: 'Each message needs a user or assistant role and text.' }
    }
    kept.push({ role: message.role, content: message.content })
  }

  return {
    turnstileToken,
    thread: {
      book: { title: book.title, author: book.author },
      ...(chapter ? { chapter } : {}),
      ...(passage ? { passage } : {}),
      messages: kept,
    },
  }
}

async function verifyTurnstile(
  { turnstileSecret = '', fetcher = fetch }: ThreadsOptions,
  token: string,
  ip: string,
): Promise<boolean> {
  if (!token) return false
  const form = new FormData()
  form.set('secret', turnstileSecret.trim())
  form.set('response', token)
  if (ip) form.set('remoteip', ip)

  const response = await fetchUpstream(fetcher, SITEVERIFY_URL, { method: 'POST', body: form })
  if (!response?.ok) return false
  const result = (await response.json().catch(() => null)) as { success?: unknown } | null
  return result?.success === true
}

function threadUrl(request: Request, id: string): string {
  return new URL(`/t/${id}`, request.url).toString()
}

function now(options: ThreadsOptions): number {
  return options.now?.() ?? Date.now()
}

function expiresAt(publishedAt: number): number {
  return publishedAt + THREAD_TTL_SECONDS * 1000
}

function randomToken(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...raw))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Compares without stopping at the first difference. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function errorResponse(status: number, message: string): Response {
  return json({ error: { message } }, status)
}
