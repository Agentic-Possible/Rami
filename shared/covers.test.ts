import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleCoverRequest, parseSearchResults } from './covers.ts'

/** Trimmed from a real `search.json` response for Moby Dick. */
const SEARCH_BODY = {
  docs: [
    {
      title: 'Moby Dick',
      author_name: ['Herman Melville'],
      cover_i: 10544254,
      first_publish_year: 1851,
    },
    { title: 'Moby Dick', author_name: ['Herman Melville'], cover_i: 10544254 },
    { title: 'Moby Dick by Herman Melville', author_name: ['Herman Melville'] },
    { title: 'Moby-Dick', cover_i: 12116552 },
  ],
}

function coverRequest(query: string, headers?: Record<string, string>): Request {
  return new Request(`https://marginalia.test/api/covers?${query}`, { headers })
}

function jpeg(bytes = 4, headers: Record<string, string> = {}): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'image/jpeg', ...headers },
  })
}

let fetchMock: ReturnType<typeof vi.fn>
const relay = (query: string, headers?: Record<string, string>) =>
  handleCoverRequest(coverRequest(query, headers), {
    fetch: fetchMock as unknown as typeof fetch,
  })

// The throttle lives in module scope; each test runs an hour after the last.
let clock = Date.now()

beforeEach(() => {
  clock += 3_600_000
  vi.useFakeTimers()
  vi.setSystemTime(clock)
  fetchMock = vi.fn()
})

afterEach(() => {
  clock = Date.now()
  vi.useRealTimers()
})

describe('cover search', () => {
  it('asks Open Library for the title and author and answers with candidates', async () => {
    fetchMock.mockResolvedValue(Response.json(SEARCH_BODY))

    const response = await relay('title=Moby%20Dick&author=Herman%20Melville')

    expect(response.status).toBe(200)
    const [url] = fetchMock.mock.calls[0] as [URL]
    expect(url.origin + url.pathname).toBe('https://openlibrary.org/search.json')
    expect(url.searchParams.get('title')).toBe('Moby Dick')
    expect(url.searchParams.get('author')).toBe('Herman Melville')
    expect(await response.json()).toEqual({
      results: [
        { id: 10544254, title: 'Moby Dick', author: 'Herman Melville', year: 1851 },
        { id: 12116552, title: 'Moby-Dick' },
      ],
    })
  })

  it('retries on the title alone when the author matches nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ docs: [] }))
      .mockResolvedValueOnce(Response.json(SEARCH_BODY))

    const response = await relay('title=Moby%20Dick&author=Melville%2C%20H.')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [retry] = fetchMock.mock.calls[1] as [URL]
    expect(retry.searchParams.has('author')).toBe(false)
    const body = (await response.json()) as { results: unknown[] }
    expect(body.results).toHaveLength(2)
  })

  it('reports a failed upstream as unavailable rather than as no covers', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }))

    expect((await relay('title=Moby%20Dick')).status).toBe(502)
  })

  it('rejects an overlong search before calling upstream', async () => {
    expect((await relay(`title=${'a'.repeat(201)}`)).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('cover download', () => {
  it('fetches only the numeric cover id, asking for a 404 instead of a blank placeholder', async () => {
    fetchMock.mockResolvedValue(jpeg())

    const response = await relay('id=10544254')

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://covers.openlibrary.org/b/id/10544254-L.jpg?default=false',
      expect.objectContaining({ redirect: 'follow' }),
    )
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toContain('immutable')
  })

  it.each(['../../etc/passwd', 'https%3A%2F%2Fevil.test%2Fa.jpg', '12a'])(
    'refuses %s instead of becoming an open proxy',
    async (id) => {
      expect((await relay(`id=${id}`)).status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('accepts only the M and L sizes', async () => {
    expect((await relay('id=1&size=S')).status).toBe(400)
  })

  it('passes a missing cover through as 404', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }))

    expect((await relay('id=1')).status).toBe(404)
  })

  it('refuses anything that is not a raster image', async () => {
    fetchMock.mockResolvedValue(
      new Response('<svg onload="alert(1)"/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    )

    expect((await relay('id=1')).status).toBe(502)
  })

  it('refuses an image past the size cap, declared or not', async () => {
    fetchMock.mockResolvedValueOnce(jpeg(4, { 'Content-Length': String(3 * 1024 * 1024) }))
    expect((await relay('id=1')).status).toBe(502)

    fetchMock.mockResolvedValueOnce(jpeg(3 * 1024 * 1024))
    expect((await relay('id=2')).status).toBe(502)
  })

  it('stops reading an undeclared oversized image instead of buffering it whole', async () => {
    let pulled = 0
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1
        controller.enqueue(new Uint8Array(512 * 1024))
      },
    })
    fetchMock.mockResolvedValue(
      new Response(endless, { headers: { 'Content-Type': 'image/jpeg' } }),
    )

    expect((await relay('id=1')).status).toBe(502)
    expect(pulled).toBeLessThan(10)
  })

  it('answers a stalled upstream with a timeout instead of hanging', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )

    const pending = relay('id=1')
    await vi.advanceTimersByTimeAsync(20_000)

    expect((await pending).status).toBe(504)
  })
})

describe('request policy', () => {
  it('turns away another site hotlinking covers through this one', async () => {
    const response = await relay('id=1', { 'Sec-Fetch-Site': 'cross-site' })

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts only GET', async () => {
    const response = await handleCoverRequest(
      new Request('https://marginalia.test/api/covers?id=1', { method: 'POST' }),
    )
    expect(response.status).toBe(405)
  })

  it('needs either a title or an id', async () => {
    expect((await relay('author=Melville')).status).toBe(400)
  })
})

describe('parseSearchResults', () => {
  it('caps the grid at eight covers', () => {
    const docs = Array.from({ length: 20 }, (_, i) => ({ title: `Edition ${i}`, cover_i: i + 1 }))
    expect(parseSearchResults({ docs })).toHaveLength(8)
  })

  it('skips malformed entries instead of throwing', () => {
    expect(
      parseSearchResults({ docs: [null, { cover_i: '12' }, { cover_i: -1 }, { cover_i: 7 }] }),
    ).toEqual([{ id: 7, title: '' }])
    expect(parseSearchResults({ docs: 'nope' })).toEqual([])
  })
})
