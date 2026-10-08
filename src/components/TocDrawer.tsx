import type { NavItem } from 'epubjs'
import ReaderPanel from './ReaderPanel'

export default function TocDrawer({
  toc,
  bookTitle,
  currentChapterHref,
  onSelect,
  onClose,
}: {
  toc: NavItem[]
  bookTitle?: string
  /** Exact TOC href of the current chapter, anchor included. */
  currentChapterHref?: string
  onSelect: (href: string) => void
  onClose: () => void
}) {
  return (
    <ReaderPanel label="Table of contents" eyebrow={bookTitle} title="Contents" onClose={onClose}>
      <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-safe">
        {toc.length === 0 && (
          <p className="px-3 py-4 font-book text-body text-ink-soft">
            This book has no table of contents.
          </p>
        )}
        <TocList
          items={toc}
          depth={0}
          currentChapterHref={currentChapterHref}
          onSelect={onSelect}
        />
      </nav>
    </ReaderPanel>
  )
}

function TocList({
  items,
  depth,
  currentChapterHref,
  onSelect,
}: {
  items: NavItem[]
  depth: number
  currentChapterHref?: string
  onSelect: (href: string) => void
}) {
  return (
    <ul>
      {items.map((item, i) => {
        const isCurrent = Boolean(currentChapterHref && item.href === currentChapterHref)
        return (
          <li key={`${item.href}-${i}`}>
            <button
              onClick={() => item.href && onSelect(item.href)}
              aria-current={isCurrent ? 'location' : undefined}
              style={{ paddingLeft: `${0.75 + depth * 0.9}rem` }}
              className={`flex min-h-tap w-full items-center gap-3 rounded-md py-2.5 pr-3 text-left transition-colors duration-150 hover:bg-paper-sunk ${
                isCurrent ? 'bg-paper-sunk' : ''
              }`}
            >
              <span
                className={`line-clamp-2 flex-1 font-book ${
                  depth === 0 ? 'text-book-title font-medium' : 'text-body text-ink-soft'
                }`}
              >
                {item.label?.trim() || 'Untitled'}
              </span>
              {isCurrent && <small className="eyebrow shrink-0">Reading now</small>}
            </button>
            {item.subitems && item.subitems.length > 0 && (
              <TocList
                items={item.subitems}
                depth={depth + 1}
                currentChapterHref={currentChapterHref}
                onSelect={onSelect}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
