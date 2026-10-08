import { useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import type { Book } from '../db/types'
import {
  checkUploadedCover,
  downloadCover,
  mainTitle,
  searchCovers,
  type CoverCandidate,
} from '../lib/covers'
import { readEpubCover } from '../lib/epub'
import { useBlobUrl } from '../lib/useBlobUrl'
import { useModal } from '../lib/useModal'
import { button, iconButton } from './ui'
import { CloseIcon } from './Icons'

/** What is being saved: a cover id, an uploaded image, or the EPUB's own cover. */
type Saving = number | 'upload' | 'restore'

/**
 * Finds covers for a book and swaps one in with a single tap.
 *
 * The search starts as the sheet opens, from the book's own title and author,
 * so the usual case is open, tap, done. The query is editable for books whose
 * metadata finds nothing, an upload covers books Open Library does not know,
 * and the EPUB's own cover can always be put back.
 */
export default function CoverPickerDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const ref = useModal<HTMLElement>(onClose, '[data-close]')
  const currentUrl = useBlobUrl(book.cover)
  const upload = useRef<HTMLInputElement>(null)
  const initialQuery = mainTitle(book.title)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<CoverCandidate[]>([])
  const [searching, setSearching] = useState(true)
  const [searchError, setSearchError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  // Thumbnails that would not load. Hidden rather than shown as broken tiles.
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<Saving>()
  const [saveError, setSaveError] = useState<string>()

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    setSearchError(undefined)
    // The first search runs at once; only typing is debounced.
    const delay = trimmed === initialQuery ? 0 : 400
    const timer = window.setTimeout(() => {
      void searchCovers(trimmed, book.author, controller.signal)
        .then((covers) => {
          setResults(covers)
          setBroken(new Set())
        })
        .catch((err) => {
          if (controller.signal.aborted) return
          setResults([])
          setSearchError(err instanceof Error ? err.message : 'Search failed.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, attempt, initialQuery, book.author])

  // A download the reader walked away from must not land on the book.
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  async function save(kind: Saving, load: (signal: AbortSignal) => Promise<Blob | undefined>) {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setSaving(kind)
    setSaveError(undefined)
    try {
      const cover = await load(controller.signal)
      if (controller.signal.aborted) return
      await db.books.update(book.id, { cover })
      onClose()
    } catch (err) {
      if (controller.signal.aborted) return
      setSaveError(err instanceof Error ? err.message : 'Could not change the cover.')
      setSaving(undefined)
    }
  }

  function chooseFile(file: File | undefined) {
    if (upload.current) upload.current.value = ''
    if (!file) return
    const problem = checkUploadedCover(file)
    if (problem) {
      setSaveError(problem)
      return
    }
    void save('upload', async () => file)
  }

  // An EPUB with no cover of its own restores to the cloth placeholder.
  const restore = () =>
    save('restore', async () => (book.file ? readEpubCover(book.file) : undefined))
  const visible = results.filter((cover) => !broken.has(cover.id))
  const busy = saving !== undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-picker-title"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-lg border border-rule bg-paper-leaf p-5 text-ink shadow-sheet sm:max-w-2xl sm:rounded-lg sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="cover-picker-title" className="font-book text-heading font-medium">
              Change cover
            </h2>
            <p className="truncate font-ui text-meta text-ink-soft">
              {book.title} · {book.author}
            </p>
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className={`${iconButton} -mt-1.5`}
          >
            <CloseIcon />
          </button>
        </div>

        <label htmlFor="cover-search" className="eyebrow mt-5 block">
          Search Open Library
        </label>
        <input
          id="cover-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Book title"
          className="mt-2 w-full min-h-tap w-full rounded-md border border-rule-strong bg-paper px-3.5 font-ui text-control text-ink placeholder:text-ink-faint"
        />

        {searchError && (
          <div className="mt-3 flex items-start justify-between gap-3">
            <p className="font-ui text-meta text-danger">{searchError}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className={button.secondary}
            >
              Retry
            </button>
          </div>
        )}
        {saveError && <p className="mt-3 font-ui text-meta text-danger">{saveError}</p>}

        <ul aria-busy={searching} className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {currentUrl && (
            <li>
              <div className="relative aspect-2/3 overflow-hidden rounded-[2px_6px_6px_2px] ring-2 ring-moss">
                <img src={currentUrl} alt="Current cover" className="h-full w-full object-cover" />
              </div>
              <p className="mt-1.5 text-center font-ui text-caption font-medium text-moss">
                Current
              </p>
            </li>
          )}

          {searching &&
            Array.from({ length: 6 }, (_, index) => (
              <li key={`placeholder-${index}`} aria-hidden>
                <div className="aspect-2/3 animate-pulse rounded-[2px_6px_6px_2px] bg-rule" />
              </li>
            ))}

          {!searching &&
            visible.map((cover) => (
              <li key={cover.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save(cover.id, (signal) => downloadCover(cover.id, signal))}
                  aria-label={`Use the cover of ${cover.title}${cover.year ? ` (${cover.year})` : ''}`}
                  className="relative block aspect-2/3 w-full overflow-hidden rounded-[2px_6px_6px_2px] bg-rule shadow-book transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-moss disabled:opacity-60"
                >
                  <img
                    src={cover.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={() => setBroken((prev) => new Set(prev).add(cover.id))}
                  />
                  {saving === cover.id && (
                    <span className="absolute inset-0 grid place-items-center bg-scrim font-ui text-caption font-medium text-cloth-lettering">
                      Saving…
                    </span>
                  )}
                </button>
                {cover.year && (
                  <p className="mt-1.5 text-center font-ui text-caption text-ink-faint">
                    {cover.year}
                  </p>
                )}
              </li>
            ))}
        </ul>

        {!searching && !searchError && query.trim().length >= 2 && visible.length === 0 && (
          <p className="mt-3 font-ui text-meta text-ink-soft">
            No covers found. Try a shorter title, or upload an image.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => upload.current?.click()}
            className={button.secondary}
          >
            {saving === 'upload' ? 'Saving…' : 'Upload image'}
          </button>
          {book.file && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void restore()}
              className={button.secondary}
            >
              {saving === 'restore' ? 'Restoring…' : 'Restore original'}
            </button>
          )}
          <p className="ml-auto font-ui text-caption text-ink-faint">Covers from Open Library</p>
        </div>

        <input
          ref={upload}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          className="hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
      </section>
    </div>
  )
}
