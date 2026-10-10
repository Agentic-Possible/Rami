import type { MouseEvent } from 'react'
import type { SelectionRect } from '../lib/highlights'
import { TAP_TURN_ZONE, type PageDirection } from '../lib/selectionEdge'
import { ChatIcon, TrashIcon } from './Icons'
import { button, iconButton } from './ui'

const BAR_HEIGHT = 70

export default function SelectionBar({
  rect,
  existing,
  onChat,
  onCopy,
  onDelete,
  onDismiss,
  onTurn,
  page,
}: {
  rect: SelectionRect
  /** Set when the bar was opened by tapping an existing highlight. */
  existing?: boolean
  onChat: () => void
  onCopy: () => void
  onDelete?: () => void
  onDismiss: () => void
  /** Turns the page under the selection, keeping it, from a tap at a page edge. */
  onTurn?: (direction: PageDirection) => void
  /** The reader's page, which edge taps are measured against; it is centered and capped on wide screens. */
  page?: HTMLElement | null
}) {
  // Prefer sitting above the selection; drop below when it would clip the top.
  const above = rect.top > BAR_HEIGHT + 60
  const top = above ? rect.top - BAR_HEIGHT - 8 : rect.bottom + 12
  // A selection filling the page leaves no room either side; stay on screen.
  const clamped = Math.min(Math.max(8, top), window.innerHeight - BAR_HEIGHT - 8)

  // The backdrop covers the book, so it answers the page-edge taps the book
  // would: a selection can then be carried to the next page and extended there.
  const onBackdrop = (event: MouseEvent) => {
    const bounds = page?.getBoundingClientRect() ?? { left: 0, width: window.innerWidth }
    const x = (event.clientX - bounds.left) / bounds.width
    if (onTurn && x < TAP_TURN_ZONE) onTurn('prev')
    else if (onTurn && x > 1 - TAP_TURN_ZONE) onTurn('next')
    else onDismiss()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onBackdrop} aria-hidden />
      <div
        role="toolbar"
        aria-label="Selection actions"
        style={{ top: clamped }}
        className="no-select fixed inset-x-3 z-50 mx-auto flex max-w-[420px] items-center gap-2 rounded-lg border border-rule bg-paper-leaf p-3 text-ink shadow-sheet"
      >
        {existing && onDelete && (
          <button
            onClick={onDelete}
            aria-label="Delete highlight"
            className={`${iconButton} border border-rule-strong`}
          >
            <TrashIcon />
          </button>
        )}
        <button onClick={onChat} className={`${button.primary} flex-1`}>
          <ChatIcon />
          Ask about this
        </button>
        <button onClick={onCopy} className={button.secondary}>
          Copy
        </button>
      </div>
    </>
  )
}
