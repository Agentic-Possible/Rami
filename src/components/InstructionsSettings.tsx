import { useEffect, useState } from 'react'
import { saveSettings } from '../db/db'
import { MAX_INSTRUCTIONS_CHARS } from '../lib/prompt'
import { button, card } from './ui'

/**
 * The reader's standing instructions to Rami.
 *
 * Unlike the per-book digest, which Rami writes from text a book supplied and
 * so is fenced as untrusted, only the reader writes this, so it goes into the
 * system message as instructions to follow.
 */
export default function InstructionsSettings({ stored = '' }: { stored?: string }) {
  const [draft, setDraft] = useState(stored)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(stored)
  }, [stored, dirty])

  const commit = async () => {
    const text = draft.trim()
    await saveSettings({ instructions: text || undefined })
    setDirty(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className={card}>
      <h2 className="font-book text-heading font-medium">Standing instructions</h2>
      <p className="mt-1 font-ui text-body text-ink-soft">
        Sent with every message about every book. Tell Rami what to call you, how to answer, or
        anything else it should always do.
      </p>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setDirty(true)
        }}
        rows={4}
        maxLength={MAX_INSTRUCTIONS_CHARS}
        placeholder="For example: Call me Sam, and work in a little Latin so I can start learning it."
        aria-label="Standing instructions"
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
    </section>
  )
}
