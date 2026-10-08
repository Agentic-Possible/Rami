import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { archiveBook, db, deleteBook } from '../db/db'
import type { Book } from '../db/types'
import { EpubImportError } from '../lib/epub'
import { importEpub } from '../lib/importBook'
import { seedSampleBooks } from '../lib/sampleBook'
import { useBlobUrl } from '../lib/useBlobUrl'
import AddBookDialog from '../components/AddBookDialog'
import RemoveBookDialog from '../components/RemoveBookDialog'
import { ChatIcon, ChevronIcon, GearIcon, MoreIcon, PlusIcon, TrashIcon } from '../components/Icons'

export default function LibraryPage() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [seeding, setSeeding] = useState(true)
  const [error, setError] = useState<string>()
  const [confirmRemove, setConfirmRemove] = useState<Book>()
  const [showAddBook, setShowAddBook] = useState(false)

  // Most recently read first, so the book in progress is the one under the
  // thumb. A book that has never been opened falls back to when it arrived,
  // which puts a fresh import at the top where its reader is looking for it.
  //
  // Sorted here rather than by index: `lastOpenedAt` is only written once a book
  // has been opened, and IndexedDB leaves records with no value for a key out of
  // that key's index entirely, so ordering by it would hide every unread book.
  const shelved = useLiveQuery(
    () =>
      db.books
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt)),
        ),
    [],
  )
  const books = shelved?.filter((book) => !book.archivedAt)
  const archived = shelved?.filter((book) => book.archivedAt)
  const chatCounts = useLiveQuery(async () => {
    const rows = await db.conversations.toArray()
    return rows.reduce<Record<string, number>>((acc, c) => {
      acc[c.bookId] = (acc[c.bookId] ?? 0) + 1
      return acc
    }, {})
  }, [])

  // A first-time visitor gets the bundled public-domain shelf, so there is
  // something to open before they have found an EPUB of their own.
  useEffect(() => {
    let active = true
    void seedSampleBooks().then(() => {
      if (active) setSeeding(false)
    })
    return () => {
      active = false
    }
  }, [])

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setImporting(true)
    setError(undefined)
    const failures: string[] = []
    for (const file of Array.from(files)) {
      try {
        await importEpub(file)
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof EpubImportError ? err.message : 'Import failed.'}`,
        )
      }
    }
    if (failures.length) setError(failures.join('\n'))
    setImporting(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  const continuing = books?.find((book) => book.lastOpenedAt)
  const highlightCount = useLiveQuery(() => db.highlights.count(), [])

  return (
    <div className="min-h-full bg-paper bg-[radial-gradient(circle_at_85%_-10%,rgba(167,177,145,0.18),transparent_32rem)] text-ink">
      <header className="pt-safe sticky top-0 z-10 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-[clamp(16px,5vw,72px)] sm:h-[76px]">
          <Link
            to="/"
            className="flex items-center gap-3 font-serif text-[19px] font-semibold sm:text-[22px]"
          >
            <BrandMark />
            Marginalia
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              aria-label="Settings"
              className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-ink/8"
            >
              <GearIcon />
            </Link>
            <button
              onClick={() => setShowAddBook(true)}
              disabled={importing}
              aria-label="Add book"
              className="ml-1 flex h-10 items-center gap-2 rounded-full bg-olive px-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(49,61,47,0.15)] transition hover:bg-olive-deep disabled:opacity-50 sm:h-[42px] sm:px-[18px]"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline">{importing ? 'Importing…' : 'Add book'}</span>
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept=".epub,application/epub+zip"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <main className="mx-auto w-[min(1120px,calc(100%-32px))] pt-10 pb-16 sm:w-[min(1120px,calc(100%-48px))] sm:pt-[68px] sm:pb-[88px]">
        <section className="mb-7 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-2 text-rust">Your library</p>
            <h1 className="font-serif text-[clamp(36px,5vw,54px)] leading-[1.05] font-medium tracking-[-0.035em]">
              {greeting()}
            </h1>
            <p className="mt-2.5 text-[15px] text-muted">
              {continuing
                ? 'Pick up where you left off, or begin something new.'
                : 'Open a book, highlight a passage, and talk it over.'}
            </p>
          </div>
          {books && (
            <p className="hidden text-[13px] text-faint sm:block">
              {plural(books.length, 'book')}
              {highlightCount ? ` · ${plural(highlightCount, 'highlight')}` : ''}
            </p>
          )}
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-rust/30 bg-rust/5 p-3 text-sm whitespace-pre-line text-rust">
            {error}
          </div>
        )}

        {continuing && <ContinueCard book={continuing} />}

        {books && books.length === 0 && !seeding && (
          <EmptyState onPick={() => setShowAddBook(true)} />
        )}

        {books && books.length === 0 && seeding && (
          <p className="mt-24 text-center text-sm text-muted">Setting up your library…</p>
        )}

        {books && books.length > 0 && (
          <section className={continuing ? 'mt-14' : ''}>
            <h2 className="mb-5 font-serif text-[25px] font-medium">All books</h2>
            <ul className="grid grid-cols-2 gap-x-[18px] gap-y-[34px] sm:grid-cols-3 sm:gap-x-[30px] sm:gap-y-[42px] lg:grid-cols-4">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  chatCount={chatCounts?.[book.id] ?? 0}
                  onDelete={() => setConfirmRemove(book)}
                />
              ))}
              <li>
                <button
                  onClick={() => setShowAddBook(true)}
                  disabled={importing}
                  className="flex aspect-2/3 w-full flex-col items-center justify-center rounded-lg border border-dashed border-[#b9baae] bg-white/20 px-3 text-center text-[#707168] transition hover:bg-white/40"
                >
                  <span className="mb-4 grid h-[45px] w-[45px] place-items-center rounded-full border border-[#c9c9bf]">
                    <PlusIcon className="h-[22px] w-[22px]" />
                  </span>
                  <strong className="text-[13px]">{importing ? 'Importing…' : 'Add a book'}</strong>
                  <small className="mt-1.5 text-[11px] text-faint">
                    Stored privately on this device
                  </small>
                </button>
              </li>
            </ul>
          </section>
        )}

        {archived && archived.length > 0 && (
          <ArchivedShelf books={archived} chatCounts={chatCounts} onDelete={setConfirmRemove} />
        )}
      </main>

      {showAddBook && (
        <AddBookDialog
          onClose={() => setShowAddBook(false)}
          onChooseFile={() => {
            setShowAddBook(false)
            fileInput.current?.click()
          }}
          onImport={importEpub}
        />
      )}

      {confirmRemove && (
        <RemoveBookDialog
          book={confirmRemove}
          theme="light"
          onCancel={() => setConfirmRemove(undefined)}
          onRemove={async (choice) => {
            if (choice === 'keep') await archiveBook(confirmRemove.id)
            else await deleteBook(confirmRemove.id)
            setConfirmRemove(undefined)
          }}
        />
      )}
    </div>
  )
}

function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid h-[34px] w-[34px] place-items-center rounded-[50%_50%_50%_12%] bg-olive font-serif text-[17px] text-[#f7f5ed]"
    >
      M
    </span>
  )
}

function greeting(now = new Date()) {
  const hour = now.getHours()
  if (hour < 5) return 'Good evening.'
  if (hour < 12) return 'Good morning.'
  if (hour < 18) return 'Good afternoon.'
  return 'Good evening.'
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** "12 minutes ago", "yesterday", "last week": coarse, like a shelf label. */
function lastRead(timestamp: number, now = Date.now()) {
  const minutes = Math.round((timestamp - now) / 60_000)
  if (minutes > -1) return 'just now'
  if (minutes > -60) return RELATIVE.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return RELATIVE.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (days > -7) return RELATIVE.format(days, 'day')
  const weeks = Math.round(days / 7)
  if (weeks > -5) return RELATIVE.format(weeks, 'week')
  return new Date(timestamp).toLocaleDateString()
}

/** Cloth colours for books that ship without cover art, picked by id so a book keeps its own. */
const CLOTHS = [
  'bg-[#4e5b47] text-[#e7e3ce]',
  'bg-[#bccac8] text-[#1e3440]',
  'bg-[#70443c] text-[#efe7d1]',
  'bg-[#3f4a5a] text-[#e4e1d6]',
  'bg-[#c9b48f] text-[#3a2d1f]',
]

function clothFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return CLOTHS[Math.abs(hash) % CLOTHS.length]
}

function Cover({ book, compact }: { book: Book; compact?: boolean }) {
  const coverUrl = useBlobUrl(book.cover)
  if (coverUrl) {
    return <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
  }
  return (
    <div
      className={`flex h-full flex-col items-center justify-center text-center ${compact ? 'p-2.5' : 'p-[12%]'} ${clothFor(book.id)}`}
    >
      <span
        className={`line-clamp-4 font-serif leading-[1.05] font-medium tracking-[0.04em] uppercase ${compact ? 'text-sm' : 'text-[clamp(16px,2vw,24px)]'}`}
      >
        {book.title}
      </span>
      <span
        className={`mt-3 line-clamp-2 tracking-[0.16em] uppercase ${compact ? 'text-[7px]' : 'text-[8px]'}`}
      >
        {book.author}
      </span>
    </div>
  )
}

function ContinueCard({ book }: { book: Book }) {
  const navigate = useNavigate()
  const progress = Math.round((book.progress ?? 0) * 100)

  return (
    <button
      onClick={() => navigate(`/book/${book.id}`)}
      aria-label={`Continue reading ${book.title}`}
      className="grid w-full grid-cols-[76px_1fr] items-center gap-5 rounded-[20px] border border-[#444e3e]/15 bg-card/80 p-[18px] text-left shadow-[0_10px_40px_rgba(50,52,43,0.055)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(50,52,43,0.09)] sm:min-h-[190px] sm:grid-cols-[100px_1fr_auto] sm:gap-[30px] sm:px-7 sm:py-6"
    >
      <div className="h-[112px] w-[76px] overflow-hidden rounded-[4px_8px_8px_4px] shadow-[-4px_4px_12px_rgba(38,38,31,0.2)] sm:h-[142px] sm:w-[100px]">
        <Cover book={book} compact />
      </div>
      <div className="min-w-0">
        <p className="eyebrow mb-2 text-rust">Continue reading</p>
        <h2 className="line-clamp-2 font-serif text-2xl leading-[1.1] font-medium sm:text-[29px]">
          {book.title}
        </h2>
        <p className="mt-2 mb-3.5 truncate font-serif text-[15px] text-muted sm:mb-5">
          {book.author}
        </p>
        <div className="flex max-w-[370px] items-center gap-3">
          <span className="h-[3px] flex-1 overflow-hidden rounded-lg bg-[#deddd4]">
            <i className="block h-full bg-rust" style={{ width: `${progress}%` }} />
          </span>
          <strong className="text-[11px] text-[#65665d]">{progress}%</strong>
        </div>
      </div>
      <span className="hidden p-[18px] text-[#8b8c83] sm:block">
        <ChevronIcon className="h-6 w-6" />
      </span>
    </button>
  )
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="mt-20 text-center">
      <h2 className="font-serif text-2xl font-medium">Your library is empty</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
        Search Project Gutenberg or add a DRM-free EPUB. Books are stored on this device only.
      </p>
      <button
        onClick={onPick}
        className="mt-6 rounded-full bg-olive px-5 py-2.5 text-sm font-semibold text-white"
      >
        Add a book
      </button>
    </div>
  )
}

function BookCard({
  book,
  chatCount,
  onDelete,
}: {
  book: Book
  chatCount: number
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const progress = Math.round((book.progress ?? 0) * 100)

  return (
    <li className="min-w-0">
      <button
        onClick={() => navigate(`/book/${book.id}`)}
        aria-label={`${book.title}, ${book.author}`}
        className="relative block aspect-2/3 w-full overflow-hidden rounded-[3px_10px_10px_3px] text-left shadow-[-6px_7px_18px_rgba(47,45,38,0.19)] transition duration-300 hover:-translate-y-1 hover:rotate-[0.3deg] hover:shadow-[-7px_13px_24px_rgba(47,45,38,0.22)]"
      >
        <Cover book={book} />

        {chatCount > 0 && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rust px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <ChatIcon className="h-3 w-3" />
            {chatCount}
          </span>
        )}

        {progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/20">
            <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
          </div>
        )}
      </button>

      <div className="flex items-start justify-between gap-2 pt-3.5">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-serif text-[17px] leading-tight font-medium">
            {book.title}
          </h3>
          <p className="my-1 truncate text-xs text-muted">{book.author}</p>
          <span className="text-[11px] text-faint">
            {progress}%{book.lastOpenedAt ? ` · ${lastRead(book.lastOpenedAt)}` : ' · Not started'}
          </span>
        </div>
        <button
          onClick={onDelete}
          aria-label={`Remove ${book.title}`}
          className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/8"
        >
          <MoreIcon className="h-[18px] w-[18px]" />
        </button>
      </div>
    </li>
  )
}
/**
 * Books the reader removed but chose to keep the notes for.
 *
 * Kept visible rather than silently held in storage: the conversations and
 * memory are still there, still reachable, and importing the EPUB again puts
 * the book back where it was.
 */
function ArchivedShelf({
  books,
  chatCounts,
  onDelete,
}: {
  books: Book[]
  chatCounts?: Record<string, number>
  onDelete: (book: Book) => void
}) {
  return (
    <section className="mt-16 border-t border-ink/10 pt-8">
      <h2 className="font-serif text-xl font-medium">Removed books</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Their conversations, highlights and memory are kept. Import the same EPUB file again to pick
        up where you left off.
      </p>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {books.map((book) => (
          <ArchivedRow
            key={book.id}
            book={book}
            chatCount={chatCounts?.[book.id] ?? 0}
            onDelete={() => onDelete(book)}
          />
        ))}
      </ul>
    </section>
  )
}

function ArchivedRow({
  book,
  chatCount,
  onDelete,
}: {
  book: Book
  chatCount: number
  onDelete: () => void
}) {
  const coverUrl = useBlobUrl(book.cover)

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-card/70 p-2.5">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-[2px_5px_5px_2px] bg-line">
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] font-medium">{book.title}</p>
        <p className="truncate text-xs text-muted">{book.author}</p>
        <Link
          to={`/book/${book.id}/chats`}
          className="mt-0.5 inline-block text-xs text-rust underline underline-offset-2"
        >
          {chatCount === 1 ? '1 conversation' : `${chatCount} conversations`} and memory
        </Link>
      </div>

      <button
        onClick={onDelete}
        aria-label={`Delete ${book.title} and its notes`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink/8 hover:text-ink"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </li>
  )
}
