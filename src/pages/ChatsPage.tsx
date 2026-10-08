import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteConversation, getSettings } from '../db/db'
import { DEFAULT_SETTINGS } from '../db/types'
import { HIGHLIGHT_COLORS } from '../lib/highlights'
import ChatSheet from '../components/ChatSheet'
import MemoryPanel from '../components/MemoryPanel'
import { BackIcon, TrashIcon } from '../components/Icons'

type Tab = 'chats' | 'highlights' | 'memory'

export default function ChatsPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const [tab, setTab] = useState<Tab>('chats')
  const [chatId, setChatId] = useState<string>()

  const book = useLiveQuery(() => (bookId ? db.books.get(bookId) : undefined), [bookId])
  const conversations = useLiveQuery(
    () =>
      bookId ? db.conversations.where('bookId').equals(bookId).reverse().sortBy('updatedAt') : [],
    [bookId],
  )
  const highlights = useLiveQuery(
    () =>
      bookId ? db.highlights.where('bookId').equals(bookId).reverse().sortBy('createdAt') : [],
    [bookId],
  )
  const memory = useLiveQuery(() => (bookId ? db.bookMemory.get(bookId) : undefined), [bookId])
  const settings = useLiveQuery(() => getSettings(), []) ?? DEFAULT_SETTINGS

  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="pt-safe sticky top-0 z-10 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-2 pt-2 pb-1">
          <Link
            to={bookId ? `/book/${bookId}` : '/'}
            aria-label="Back to reader"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-ink/8"
          >
            <BackIcon />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-rust">Marginalia</p>
            <h1 className="truncate font-serif text-xl font-medium">{book?.title ?? 'Book'}</h1>
          </div>
        </div>

        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto px-3 pt-2 pb-3">
          <TabButton active={tab === 'chats'} onClick={() => setTab('chats')}>
            Conversations {conversations?.length ? `(${conversations.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'highlights'} onClick={() => setTab('highlights')}>
            Highlights {highlights?.length ? `(${highlights.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'memory'} onClick={() => setTab('memory')}>
            Memory
          </TabButton>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {tab === 'chats' && (
          <>
            {conversations?.length === 0 && (
              <Empty>
                Highlight a passage while reading and tap “Chat about this” to start a conversation.
              </Empty>
            )}

            <ul className="space-y-2">
              {conversations?.map((conversation) => (
                <li
                  key={conversation.id}
                  className="flex items-start gap-2 rounded-2xl border border-ink/10 bg-card/80 p-4 shadow-[0_6px_24px_rgba(50,52,43,0.04)]"
                >
                  <button
                    onClick={() => setChatId(conversation.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="line-clamp-2 font-serif text-base font-medium">
                      {conversation.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {conversation.chapter ? `${conversation.chapter} · ` : ''}
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </p>
                  </button>
                  <button
                    onClick={() => void deleteConversation(conversation.id)}
                    aria-label={`Delete ${conversation.title}`}
                    className="rounded-lg p-2 text-muted"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'highlights' && (
          <>
            {highlights?.length === 0 && <Empty>No highlights yet.</Empty>}
            <ul className="space-y-2">
              {highlights?.map((highlight) => (
                <li
                  key={highlight.id}
                  className="flex items-start gap-3 rounded-2xl border border-ink/10 bg-card/80 p-4 shadow-[0_6px_24px_rgba(50,52,43,0.04)]"
                >
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ background: HIGHLIGHT_COLORS[settings.highlightColor] }}
                  />
                  <Link
                    to={`/book/${bookId}?cfi=${encodeURIComponent(highlight.cfiRange)}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="line-clamp-4 font-serif text-[15px] leading-relaxed">
                      {highlight.text}
                    </p>
                    {highlight.chapter && (
                      <p className="mt-1 text-xs text-muted">{highlight.chapter}</p>
                    )}
                  </Link>
                  <button
                    onClick={() => void db.highlights.delete(highlight.id)}
                    aria-label="Delete highlight"
                    className="rounded-lg p-2 text-muted"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'memory' && (
          <MemoryPanel
            // Keyed so an unsaved draft cannot follow the reader to another
            // book: this page is reused across `bookId`, and Save writes to
            // whichever book is current.
            key={bookId}
            book={book}
            memory={memory}
            latest={conversations?.[0]}
            settings={settings}
          />
        )}
      </main>

      {chatId && (
        <ChatSheet conversationId={chatId} theme="light" onClose={() => setChatId(undefined)} />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-olive text-white' : 'text-muted hover:bg-ink/5'
      }`}
    >
      {children}
    </button>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-16 text-center font-serif text-[15px] text-muted">{children}</p>
}
