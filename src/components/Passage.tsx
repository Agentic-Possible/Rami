/** The quoted passage a thread grew from: italic, with a hanging rubric quote mark. */
export default function Passage({
  cite,
  clamp,
  className = '',
  children,
}: {
  /** Where it sits in the book, e.g. "Chapter 1 · Loomings". */
  cite?: string
  /** Clamp long passages to four lines. */
  clamp?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <blockquote className={`relative m-0 rounded-md bg-paper-sunk py-4 pr-4 pl-10 ${className}`}>
      <span
        aria-hidden
        className="absolute top-1.5 left-3 font-book text-[44px] leading-none text-rubric"
      >
        “
      </span>
      <p className={`font-book text-passage text-ink italic ${clamp ? 'line-clamp-4' : ''}`}>
        {children}
      </p>
      {cite && (
        <cite className="mt-2 block font-ui text-meta text-ink-faint not-italic">{cite}</cite>
      )}
    </blockquote>
  )
}
