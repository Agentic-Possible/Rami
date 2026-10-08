import type { NavItem } from 'epubjs'
import type { ReaderTheme } from '../db/types'
import { THEMES } from '../lib/themes'
import ReaderPanel from './ReaderPanel'

export default function TocDrawer({
  toc,
  theme,
  bookTitle,
  currentChapterHref,
  onSelect,
  onClose,
}: {
  toc: NavItem[]
  theme: ReaderTheme
  bookTitle?: string
  /** Exact TOC href of the current chapter, anchor included. */
  currentChapterHref?: string
  onSelect: (href: string) => void
  onClose: () => void
}) {
  const palette = THEMES[theme]

  return (
    <ReaderPanel
      theme={theme}
      label="Table of contents"
      eyebrow={bookTitle}
      title="Contents"
      onClose={onClose}
    >
      <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-safe">
        {toc.length === 0 && (
          <p className="px-3 py-4 text-sm opacity-60">This book has no table of contents.</p>
        )}
        <TocList
          items={toc}
          depth={0}
          currentChapterHref={currentChapterHref}
          palette={palette}
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
  palette,
  onSelect,
}: {
  items: NavItem[]
  depth: number
  currentChapterHref?: string
  palette: (typeof THEMES)[ReaderTheme]
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
              style={{
                paddingLeft: `${0.75 + depth * 0.9}rem`,
                background: isCurrent
                  ? `color-mix(in srgb, ${palette.link} 9%, transparent)`
                  : undefined,
              }}
              className="flex w-full items-center gap-3 rounded-lg py-3 pr-3 text-left transition hover:bg-current/5"
            >
              <span
                className={`line-clamp-2 flex-1 font-serif leading-snug ${
                  depth === 0 ? 'text-[15px] font-medium' : 'text-sm opacity-80'
                }`}
              >
                {item.label?.trim() || 'Untitled'}
              </span>
              {isCurrent && (
                <small
                  className="shrink-0 text-[9px] font-semibold tracking-wider uppercase"
                  style={{ color: palette.link }}
                >
                  Reading now
                </small>
              )}
            </button>
            {item.subitems && item.subitems.length > 0 && (
              <TocList
                items={item.subitems}
                depth={depth + 1}
                currentChapterHref={currentChapterHref}
                palette={palette}
                onSelect={onSelect}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
