import type { HighlightColor, ReaderTheme } from '../db/types'
import { HIGHLIGHT_COLORS, type SelectionRect } from '../lib/highlights'
import { THEMES } from '../lib/themes'
import { ChatIcon, TrashIcon } from './Icons'

const BAR_HEIGHT = 68

export default function SelectionBar({
  rect,
  theme,
  existing,
  color,
  onHighlight,
  onChat,
  onCopy,
  onDelete,
  onDismiss,
}: {
  rect: SelectionRect
  theme: ReaderTheme
  /** Set when the bar was opened by tapping an existing highlight. */
  existing?: boolean
  /** The reader's highlight colour, from settings. */
  color: HighlightColor
  onHighlight: () => void
  onChat: () => void
  onCopy: () => void
  onDelete?: () => void
  onDismiss: () => void
}) {
  const palette = THEMES[theme]

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
        className={`no-select fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl border shadow-[0_16px_44px_rgba(30,30,24,0.22)] ${palette.chrome} ${palette.chromeText} ${palette.border}`}
      >
        <div className="flex items-center gap-2 p-3">
          {existing && onDelete ? (
            <button
              onClick={onDelete}
              aria-label="Delete highlight"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${palette.border}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onHighlight}
              aria-label="Highlight"
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${palette.border}`}
            >
              <span
                style={{ background: HIGHLIGHT_COLORS[color] }}
                className="block h-5 w-5 rounded-full ring-1 ring-black/20"
              />
            </button>
          )}
          <button
            onClick={onChat}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-olive py-2.5 text-sm font-semibold text-white"
          >
            <ChatIcon className="h-4 w-4" />
            Chat about this
          </button>
          <button
            onClick={onCopy}
            className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${palette.border}`}
          >
            Copy
          </button>
        </div>
      </div>
    </>
  )
}
