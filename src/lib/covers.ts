import { relayError } from './gutenberg'

export interface CoverCandidate {
  id: number
  title: string
  author?: string
  year?: number
  /** Same-origin thumbnail, small enough to show a grid of them. */
  thumbnailUrl: string
}

/** What the relay returns: Open Library's search, already filtered to works with covers. */
interface SearchResponse {
  results?: { id: number; title: string; author?: string; year?: number }[]
}

/** Largest picture a reader may upload as a cover. A phone photo fits; a scan of a poster does not. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export async function searchCovers(
  title: string,
  author?: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<CoverCandidate[]> {
  const params = new URLSearchParams({ title: title.trim() })
  // Imports with no creator get this placeholder; searching for it finds nothing.
  if (author?.trim() && author !== 'Unknown author') params.set('author', author.trim())

  const response = await fetcher(`/api/covers?${params}`, { signal })
  if (!response.ok) throw new Error(await relayError(response, 'Could not search for covers.'))

  const body = (await response.json()) as SearchResponse
  return (body.results ?? []).map((result) => ({
    ...result,
    thumbnailUrl: `/api/covers?id=${result.id}&size=M`,
  }))
}

export async function downloadCover(
  id: number,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  const response = await fetcher(`/api/covers?id=${id}&size=L`, { signal })
  if (!response.ok) throw new Error(await relayError(response, 'Could not download that cover.'))

  const blob = await response.blob()
  if (!blob.type.startsWith('image/') || blob.size === 0) {
    throw new Error('That cover could not be downloaded.')
  }
  return blob
}

/**
 * Accepts a picture the reader chose from their device. The type check is
 * about what will render in an <img>, not trust: covers are only ever shown
 * that way, never as a document.
 */
export function checkUploadedCover(file: File): string | undefined {
  if (!/^image\/(jpeg|png|gif|webp|avif)$/.test(file.type)) {
    return 'Choose a JPEG, PNG, GIF, WebP or AVIF image.'
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'That image is too large. Choose one under 10 MB.'
  return undefined
}

/**
 * "Moby Dick; Or, The Whale" finds two editions where "Moby Dick" finds
 * dozens: catalogues disagree on subtitles far more than on titles.
 */
export function mainTitle(title: string): string {
  return title.split(/[;:]|\s[-–—]\s/)[0].trim() || title.trim()
}
