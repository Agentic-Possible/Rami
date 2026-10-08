import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  downloadGutenbergBook,
  parseGutenbergRef,
  searchGutenberg,
  type CatalogBook,
} from '../lib/gutenberg'
import { useModal } from '../lib/useModal'

/** How long a search may run before the dialog admits it is being slow. */
const SLOW_SEARCH_MS = 5_000

const PRIMARY_BUTTON =
  'shrink-0 rounded-full bg-olive px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-olive-deep disabled:opacity-50'

/** Searches Project Gutenberg or hands off to the device file picker. */
export default function AddBookDialog({
  onClose,
  onChooseFile,
  onImport,
}: {
  onClose: () => void
  onChooseFile: () => void
  onImport: (file: File) => Promise<string>
}) {
  const navigate = useNavigate()
  // Searching is why the dialog opens, so focus lands in the field.
  const ref = useModal<HTMLElement>(onClose, 'input[type="search"]')
  const [query, setQuery] = useState('')
  // A pasted link resolves to a book on its own; a bare number is ambiguous
  // and gets offered alongside the search rather than instead of it.
  const pastedRef = parseGutenbergRef(query)
  const [results, setResults] = useState<CatalogBook[]>([])
  const [searching, setSearching] = useState(false)
  const [slow, setSlow] = useState(false)
  const [addingId, setAddingId] = useState<number>()
  // Kept apart because only one of them is worth offering a Retry for.
  const [searchError, setSearchError] = useState<string>()
  const [addError, setAddError] = useState<string>()
  // Bumped by Retry to re-run the effect on an unchanged query.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const trimmed = query.trim()
    // Searching for the text of a URL can only ever return nothing.
    if (pastedRef?.source === 'url' || trimmed.length < 2) {
      setResults([])
      setSearching(false)
      setSlow(false)
      setSearchError(undefined)
      return
    }

    const controller = new AbortController()
    // Set before the debounce, not inside it: during those 350 ms the results
    // are empty, and a `searching` of false there renders "No books found."
    // for a search that has not run yet.
    setSearching(true)
    setSlow(false)
    setSearchError(undefined)

    const timer = window.setTimeout(() => {
      void searchGutenberg(trimmed, controller.signal)
        .then((books) => setResults(books))
        .catch((err) => {
          if (controller.signal.aborted) return
          setResults([])
          setSearchError(err instanceof Error ? err.message : 'Search failed.')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setSearching(false)
            setSlow(false)
          }
        })
    }, 350)

    // Gutenberg is usually quick, but not always. Saying so is the difference
    // between a wait a reader will sit through and a spinner they cannot tell
    // apart from a hang.
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_SEARCH_MS)

    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(slowTimer)
      controller.abort()
    }
  }, [query, attempt, pastedRef?.source])

  // A download the reader walked away from must not land in the library or pull
  // them into the reader. The controller cancels the transfer as the dialog
  // closes; the guards cover the window after the bytes arrive.
  const download = useRef<AbortController | null>(null)
  useEffect(() => () => download.current?.abort(), [])

  async function addBook(book: { id: number; title?: string }) {
    const controller = new AbortController()
    download.current = controller
    setAddingId(book.id)
    setAddError(undefined)
    try {
      const file = await downloadGutenbergBook(book, controller.signal)
      if (controller.signal.aborted) return
      const bookId = await onImport(file)
      if (controller.signal.aborted) return
      onClose()
      navigate(`/book/${bookId}`)
    } catch (err) {
      if (controller.signal.aborted) return
      setAddError(err instanceof Error ? err.message : 'Could not add that book.')
      setAddingId(undefined)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[#1d1e19]/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-book-title"
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[20px] border border-line bg-card p-5 text-ink shadow-[0_24px_60px_rgba(30,30,24,0.25)] sm:max-w-xl sm:rounded-[20px] sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="add-book-title" className="font-serif text-xl font-medium">
              Add a book
            </h2>
            <p className="text-xs text-muted">
              Search free public-domain EPUBs or import your own.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-muted transition hover:bg-ink/8 hover:text-ink"
          >
            ×
          </button>
        </div>

        <label htmlFor="gutenberg-search" className="eyebrow mt-5 block text-rust">
          Project Gutenberg
        </label>
        <input
          id="gutenberg-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or author"
          className="mt-2 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-base text-ink outline-none placeholder:text-faint focus:border-olive"
        />
        <p className="mt-2 text-xs text-muted">
          Or paste a book link from{' '}
          <a
            href="https://www.gutenberg.org/ebooks/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-olive underline underline-offset-2"
          >
            gutenberg.org
          </a>
          .
        </p>

        {pastedRef && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/60 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Project Gutenberg #{pastedRef.id}</p>
              <p className="mt-0.5 text-xs text-muted">
                {pastedRef.source === 'url'
                  ? 'From the link you pasted.'
                  : 'Add this book id directly.'}
              </p>
            </div>
            <button
              type="button"
              disabled={addingId !== undefined}
              onClick={() => void addBook({ id: pastedRef.id })}
              className={PRIMARY_BUTTON}
            >
              {addingId === pastedRef.id ? 'Adding…' : 'Add'}
            </button>
          </div>
        )}

        {searching && (
          <p className="mt-3 text-sm text-muted">
            {slow
              ? 'Still searching. Project Gutenberg is slow right now…'
              : 'Searching Project Gutenberg…'}
          </p>
        )}
        {searchError && (
          <div className="mt-3 flex items-start justify-between gap-3">
            <p className="text-sm text-rust">{searchError}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:bg-ink/5 hover:text-ink"
            >
              Retry
            </button>
          </div>
        )}
        {addError && <p className="mt-3 text-sm text-rust">{addError}</p>}
        {!searching &&
          !pastedRef &&
          query.trim().length >= 2 &&
          !searchError &&
          results.length === 0 && <p className="mt-3 text-sm text-muted">No books found.</p>}

        {results.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-paper/60">
            {results.map((book) => (
              <li key={book.id} className="flex gap-3 p-3">
                <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-line">
                  <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] text-faint">
                    No cover
                  </span>
                  <img
                    src={book.coverUrl}
                    alt=""
                    className="relative h-full w-full object-cover"
                    loading="lazy"
                    // Some books have no cover; uncover the placeholder behind.
                    onError={(event) => {
                      event.currentTarget.hidden = true
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-serif text-[15px] leading-snug font-medium">
                    {book.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">{book.author}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {/* Editions often share a title; the number tells them apart. */}
                    <span className="text-[11px] text-faint">#{book.id}</span>
                    <button
                      type="button"
                      disabled={addingId !== undefined}
                      onClick={() => void addBook(book)}
                      className={PRIMARY_BUTTON}
                    >
                      {addingId === book.id ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="my-5 flex items-center gap-3 text-xs text-faint">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          onClick={onChooseFile}
          className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm font-medium transition hover:bg-ink/5"
        >
          Choose an EPUB from this device
        </button>
        <p className="mt-2 text-center text-xs text-faint">Books stay stored on this device.</p>
      </section>
    </div>
  )
}
