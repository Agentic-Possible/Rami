import type { SelectionRect } from '../lib/highlights'
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
}: {
  rect: SelectionRect
  /** Set when the bar was opened by tapping an existing highlight. */
  existing?: boolean
  onChat: () => void
  onCopy: () => void
  onDelete?: () => void
  onDismiss: () => void
}) {
  // Prefer sitting above the selection; drop below when it would clip the top.
  const above = rect.top > BAR_HEIGHT + 60
  const top = above ? rect.top - BAR_HEIGHT - 8 : rect.bottom + 12

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onDismiss} aria-hidden />
      <div
        role="toolbar"
        aria-label="Selection actions"
        style={{ top: Math.max(8, top) }}
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
