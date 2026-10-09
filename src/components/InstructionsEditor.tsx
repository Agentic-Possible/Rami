import { useEffect, useRef, useState } from 'react'
import { MAX_INSTRUCTIONS_CHARS } from '../lib/prompt'
import { button } from './ui'

/**
 * A box for the reader's own instructions to Rami, saved on demand.
 *
 * Unlike the per-book digest, which Rami writes from text a book supplied and
 * so is fenced as untrusted, only the reader writes these, so they go into the
 * system message as instructions to follow. Nothing imported may set them.
 */
export default function InstructionsEditor({
  stored = '',
  label,
  placeholder,
  onSave,
}: {
  stored?: string
  label: string
  placeholder: string
  /** Receives the trimmed text, or undefined to clear. */
  onSave: (instructions: string | undefined) => Promise<unknown>
}) {
  const [draft, setDraft] = useState(stored)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  // Read after the write resolves, by which point `draft` may have moved on.
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (!dirty) setDraft(stored)
  }, [stored, dirty])

  const commit = async () => {
    const text = draft
    await onSave(text.trim() || undefined)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)

    // Typing during the write would otherwise be marked saved and then
    // replaced by the effect above with what went to disk.
    if (draftRef.current === text) setDirty(false)
  }

  return (
    <>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setDirty(true)
        }}
        rows={4}
        maxLength={MAX_INSTRUCTIONS_CHARS}
        placeholder={placeholder}
        aria-label={label}
        className="mt-3 w-full resize-y rounded-md border border-rule-strong bg-paper-leaf p-3 font-ui text-body text-ink placeholder:text-ink-faint"
      />
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => void commit()} disabled={!dirty} className={button.primary}>
          Save
        </button>
        <span className="font-ui text-meta text-ink-soft">
          {saved && 'Saved'}
          {!saved && dirty && 'Unsaved changes'}
        </span>
      </div>
    </>
  )
}
