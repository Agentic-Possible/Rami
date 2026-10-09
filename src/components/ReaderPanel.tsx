import { useModal } from '../lib/useModal'
import { CloseIcon } from './Icons'
import { iconButton } from './ui'

/**
 * The side panel the reader's contents, display settings and conversations open
 * in: full width on a phone, a 360px column on anything wider.
 */
export default function ReaderPanel({
  label,
  eyebrow,
  title,
  closeLabel,
  initialFocus,
  compact = false,
  zIndex = 'z-40',
  onClose,
  children,
}: {
  /** Accessible name of the dialog. */
  label: string
  eyebrow?: string
  title: string
  closeLabel?: string
  /** Selector for the control that should take focus, if not the first one. */
  initialFocus?: string
  /** A slimmer header for panels whose content needs the height, like a thread. */
  compact?: boolean
  zIndex?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useModal<HTMLElement>(onClose, initialFocus)

  return (
    <div className={`fixed inset-0 flex justify-end ${zIndex}`}>
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="animate-panel-in relative flex h-full w-full flex-col border-l border-rule bg-paper-leaf text-ink shadow-sheet sm:w-[360px]"
      >
        <header
          className={`flex shrink-0 justify-between gap-3 border-b border-rule px-6 ${
            compact
              ? 'items-center pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 sm:pt-4'
              : 'items-start pt-[max(env(safe-area-inset-top),1.5rem)] pb-5 sm:pt-7'
          }`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className={`eyebrow truncate ${compact ? 'mb-0.5' : 'mb-1.5'}`}>{eyebrow}</p>
            )}
            <h2
              className={`line-clamp-2 font-book font-medium ${compact ? 'text-book-title' : 'text-heading'}`}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={closeLabel ?? `Close ${title.toLowerCase()}`}
            className={`${iconButton} -mr-2`}
          >
            <CloseIcon />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
