import { CloseIcon } from './Icons'
import { iconButton } from './ui'

/** A one-time aside inside a panel, set apart from the conversation it sits in. */
export default function HintNote({
  label,
  onDismiss,
  children,
}: {
  /** Names the note for the dismiss button. */
  label: string
  onDismiss: () => void
  children: React.ReactNode
}) {
  return (
    <aside
      aria-label={label}
      className="flex items-start gap-1 rounded-md border border-rule py-1 pr-1 pl-3.5 font-ui text-meta text-ink-soft"
    >
      <div className="min-w-0 flex-1 py-2">{children}</div>
      <button onClick={onDismiss} aria-label={`Dismiss: ${label}`} className={iconButton}>
        <CloseIcon />
      </button>
    </aside>
  )
}
