/** The quoted passage a thread grew from: italic, with a hanging rubric quote mark. */
export default function Passage({
  cite,
  clamp,
  expanded,
  onToggle,
  className = '',
  children,
}: {
  /** Where it sits in the book, e.g. "Chapter 1 · Loomings". */
  cite?: string
  /** Clamp long passages to four lines. */
  clamp?: boolean
  /** With `onToggle`, whether the passage is open; closed shows one line and no cite. */
  expanded?: boolean
  /** Makes the passage a toggle between one line and its full text, capped at 40vh. */
  onToggle?: () => void
  className?: string
  children: React.ReactNode
}) {
  const collapsed = onToggle !== undefined && !expanded
  // The cap scrolls the blockquote, not the text, so arrow keys on the focused
  // toggle reach a long passage's end.
  let box = collapsed ? 'py-2' : 'py-4'
  if (onToggle && !collapsed) box += ' max-h-[40vh] overflow-y-auto'
  const text = (
    <p className={`font-book text-passage text-ink italic ${fit(collapsed, clamp)}`}>{children}</p>
  )

  return (
    <blockquote className={`relative m-0 rounded-md bg-paper-sunk pr-4 pl-10 ${box} ${className}`}>
      <span
        aria-hidden
        className="absolute top-1.5 left-3 font-book text-[44px] leading-none text-rubric"
      >
        “
      </span>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={!!expanded}
          onClick={onToggle}
          className="block w-full rounded-sm text-left"
        >
          {text}
        </button>
      ) : (
        text
      )}
      {cite && !collapsed && (
        <cite className="mt-2 block font-ui text-meta text-ink-faint not-italic">{cite}</cite>
      )}
    </blockquote>
  )
}

/** How much of the passage shows: one line, four lines, or all of it. */
function fit(collapsed: boolean, clamp?: boolean): string {
  if (collapsed) return 'line-clamp-1'
  if (clamp) return 'line-clamp-4'
  return ''
}
