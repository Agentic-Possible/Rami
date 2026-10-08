import { describe, expect, it, vi } from 'vitest'
import { checkUploadedCover, downloadCover, mainTitle, searchCovers } from './covers'

describe('searchCovers', () => {
  it('searches by title and author and points thumbnails at the relay', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ results: [{ id: 42, title: 'Moby Dick', year: 1851 }] }))

    const covers = await searchCovers(' Moby Dick ', 'Herman Melville', undefined, fetcher)

    expect(fetcher).toHaveBeenCalledWith(
      '/api/covers?title=Moby+Dick&author=Herman+Melville',
      expect.anything(),
    )
    expect(covers).toEqual([
      { id: 42, title: 'Moby Dick', year: 1851, thumbnailUrl: '/api/covers?id=42&size=M' },
    ])
  })

  it('leaves out the placeholder author an import falls back to', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ results: [] }))

    await searchCovers('Beowulf', 'Unknown author', undefined, fetcher)

    expect(fetcher).toHaveBeenCalledWith('/api/covers?title=Beowulf', expect.anything())
  })

  it('shows the relay’s own explanation when it refuses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ error: 'Too many requests.' }, { status: 429 }))

    await expect(searchCovers('Beowulf', undefined, undefined, fetcher)).rejects.toThrow(
      'Too many requests.',
    )
  })
})

describe('downloadCover', () => {
  it('returns the large image as a blob', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(new Uint8Array(8), { headers: { 'Content-Type': 'image/jpeg' } }),
      )

    const blob = await downloadCover(42, undefined, fetcher)

    expect(fetcher).toHaveBeenCalledWith('/api/covers?id=42&size=L', expect.anything())
    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBe(8)
  })

  it('refuses a body that is not an image', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }))

    await expect(downloadCover(42, undefined, fetcher)).rejects.toThrow()
  })
})

describe('checkUploadedCover', () => {
  it('accepts a photo and refuses documents and oversized files', () => {
    expect(checkUploadedCover(new File([new Uint8Array(4)], 'a.jpg', { type: 'image/jpeg' }))).toBe(
      undefined,
    )
    expect(checkUploadedCover(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(
      /Choose/,
    )
    const huge = new File([new Uint8Array(11 * 1024 * 1024)], 'a.png', { type: 'image/png' })
    expect(checkUploadedCover(huge)).toMatch(/too large/)
  })
})

describe('mainTitle', () => {
  it('drops a subtitle so the search finds more editions', () => {
    expect(mainTitle('Moby Dick; Or, The Whale')).toBe('Moby Dick')
    expect(mainTitle('Frankenstein: or, The Modern Prometheus')).toBe('Frankenstein')
    expect(mainTitle('Walden — Life in the Woods')).toBe('Walden')
    expect(mainTitle('Meditations')).toBe('Meditations')
    expect(mainTitle(': odd')).toBe(': odd')
  })
})
