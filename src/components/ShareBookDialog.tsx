import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Book } from '../db/types'
import { bookCardFor, coverHash, publishBook, republishBook, unpublishBook } from '../lib/bookLink'
import { readGutenbergId } from '../lib/epub'
import { PublishError } from '../lib/publish'
import { bookShare, prefersShareSheet, shareContent } from '../lib/share'
import { useModal } from '../lib/useModal'
import BookCover from './BookCover'
import { Challenge } from './PublishDialog'
import { button } from './ui'

/**
 * Shares a book at a link that adds it to the recipient's library, with this
 * reader's cover as the preview. Nothing is sent until they confirm, and only
 * Project Gutenberg books qualify: the recipient's copy comes from there.
 * See `docs/decisions/0007-shared-book-links.md`.
 */
export default function ShareBookDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  // Live, so the dialog follows the link this device saves or removes.
  const current = useLiveQuery(() => db.books.get(book.id), [book.id]) ?? book
  const published = current.sharedLink
  // Undefined while the EPUB is read; null when it is not a Gutenberg book.
  const [gutenbergId, setGutenbergId] = useState<number | null>()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()
  // Passing the check only unlocks the button: publishing waits for the tap.
  const [token, setToken] = useState<string>()
  const ref = useModal<HTMLDivElement>(onClose, '[data-cancel]')
  const sheet = prefersShareSheet()

  useEffect(() => {
    let cancelled = false
    void (book.file ? readGutenbergId(book.file) : Promise.resolve(undefined)).then((id) => {
      if (!cancelled) setGutenbergId(id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [book.file])

  async function run(action: () => Promise<void>) {
    setWorking(true)
    setError(undefined)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setWorking(false)
    }
  }

  // The preview is meant to show the cover the reader has now, so a link sent
  // with an older one is brought up to date before it is shared again.
  const linkId = published?.id
  useEffect(() => {
    if (!linkId || !gutenbergId) return
    void run(async () => {
      const stored = await db.books.get(book.id)
      const link = stored?.sharedLink
      if (!stored || !link) return
      const hash = await coverHash(stored.cover)
      if (hash === link.coverHash) return
      try {
        const updated = await republishBook(link, await bookCardFor(stored, gutenbergId))
        await db.books.update(book.id, {
          sharedLink: { ...link, ...updated, coverHash: hash, publishedAt: Date.now() },
        })
      } catch (err) {
        // Expired or removed elsewhere: forget it, and offer a new link.
        if (err instanceof PublishError && err.status === 404) {
          await db.books.update(book.id, { sharedLink: undefined })
          return
        }
        throw err
      }
    })
  }, [linkId, gutenbergId, current.cover, book.id])

  const create = () =>
    run(async () => {
      if (!token || !gutenbergId) return
      const hash = await coverHash(current.cover)
      const link = await publishBook(await bookCardFor(current, gutenbergId), token)
      const saved = await db.books
        .update(book.id, { sharedLink: { ...link, coverHash: hash, publishedAt: Date.now() } })
        .catch(() => 0)
      // Without its owner token on this device the link could never be removed.
      if (!saved) {
        await unpublishBook(link).catch(() => undefined)
        throw new Error('Could not save the link on this device, so it was not shared.')
      }
    })

  const remove = () =>
    run(async () => {
      if (!published) return
      await unpublishBook(published)
      await db.books.update(book.id, { sharedLink: undefined })
      onClose()
    })

  async function share() {
    if (!published) return
    // A desktop copies the invitation even where a share sheet exists.
    const host = sheet ? navigator : { clipboard: navigator.clipboard }
    const outcome = await shareContent(bookShare(current, published.url), host)
    if (outcome === 'copied') setNote('Invitation copied to the clipboard.')
    else if (outcome === 'failed') setNote('Could not share. Copy the link above instead.')
  }

  const unsupported = gutenbergId === null ? unsupportedReason(book) : undefined
  // Known to be a Gutenberg book, so a link can be made.
  const shareable = typeof gutenbergId === 'number'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4 backdrop-blur-[2px]">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-book-title"
        className="w-full max-w-sm rounded-lg border border-rule bg-paper-leaf p-6 text-ink shadow-sheet"
      >
        <div className="flex items-center gap-4">
          <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded-[2px_5px_5px_2px] shadow-book">
            <BookCover book={current} compact />
          </div>
          <div className="min-w-0">
            <h2 id="share-book-title" className="font-book text-heading font-medium">
              Share book
            </h2>
            <p className="truncate font-ui text-meta text-ink-soft">{current.title}</p>
          </div>
        </div>

        {gutenbergId === undefined ? (
          <p className="mt-4 font-ui text-body text-ink-soft">Checking the book…</p>
        ) : unsupported ? (
          <p className="mt-4 font-ui text-body text-ink-soft">{unsupported}</p>
        ) : published ? (
          <>
            <input
              readOnly
              value={published.url}
              aria-label="Link to this book"
              onFocus={(e) => e.currentTarget.select()}
              className="mt-4 min-h-tap w-full rounded-md border border-rule-strong bg-paper px-3 font-ui text-meta text-ink"
            />
            <p className="mt-2 font-ui text-meta text-ink-soft">
              Opening it adds the book to the recipient’s library. The link works until{' '}
              {new Date(published.expiresAt).toLocaleDateString()}.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 font-ui text-body text-ink-soft">
              Creates a link that adds this book to anyone’s Rami library. Its preview shows your
              cover, the title and the author, and nothing else from your library. The link lasts a
              year, and you can remove it from here.
            </p>
            <Challenge onToken={setToken} onError={setError} />
          </>
        )}

        <p aria-live="polite" className="mt-3 font-ui text-meta text-ink-soft empty:hidden">
          {working ? 'Working…' : note}
        </p>
        {error && <p className="mt-3 font-ui text-meta text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {published && (
            <button onClick={() => void remove()} disabled={working} className={button.danger}>
              Remove link
            </button>
          )}
          <button data-cancel onClick={onClose} className={button.secondary}>
            {published || unsupported ? 'Done' : 'Cancel'}
          </button>
          {shareable && published && (
            <button onClick={() => void share()} disabled={working} className={button.primary}>
              {sheet ? 'Share' : 'Copy invitation'}
            </button>
          )}
          {shareable && !published && (
            <button
              onClick={() => void create()}
              disabled={working || !token}
              className={button.primary}
            >
              Create link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function unsupportedReason(book: Pick<Book, 'file'>): string {
  if (!book.file) return 'Add this book’s EPUB again to share it.'
  return 'Only books from Project Gutenberg can be shared. The recipient’s copy comes from there, and this book was added from a file.'
}
