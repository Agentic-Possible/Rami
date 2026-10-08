import type { ReaderTheme } from '../db/types'
import { THEMES } from '../lib/themes'
import { useModal } from '../lib/useModal'
import { CloseIcon } from './Icons'

/**
 * The side panel the reader's contents, display settings and conversations open
 * in: full width on a phone, a 360px column on anything wider.
 */
export default function ReaderPanel({
  theme,
  label,
  eyebrow,
  title,
  closeLabel,
  initialFocus,
  zIndex = 'z-40',
  onClose,
  children,
}: {
  theme: ReaderTheme
  /** Accessible name of the dialog. */
  label: string
  eyebrow?: string
  title: string
  closeLabel?: string
  /** Selector for the control that should take focus, if not the first one. */
  initialFocus?: string
  zIndex?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const palette = THEMES[theme]
  const ref = useModal<HTMLElement>(onClose, initialFocus)

  return (
    <div className={`fixed inset-0 flex justify-end ${zIndex}`}>
      <div className="absolute inset-0 bg-[#1d1e19]/25" onClick={onClose} aria-hidden />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ background: `color-mix(in srgb, ${palette.bg} 94%, #fff)` }}
        className={`animate-panel-in relative flex h-full w-full flex-col border-l shadow-[-12px_0_35px_rgba(0,0,0,0.12)] sm:w-[360px] ${palette.chromeText} ${palette.border}`}
      >
        <header
          className={`flex shrink-0 items-start justify-between gap-3 border-b px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-5 sm:pt-7 ${palette.border}`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="eyebrow mb-1.5 truncate" style={{ color: palette.link }}>
                {eyebrow}
              </p>
            )}
            <h2 className="line-clamp-2 font-serif text-[25px] leading-tight font-medium">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={closeLabel ?? `Close ${title.toLowerCase()}`}
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full opacity-70 transition hover:bg-current/8"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
