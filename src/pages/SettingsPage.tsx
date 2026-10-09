import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSettings, saveSettings } from '../db/db'
import { DEFAULT_SETTINGS, type HighlightColor, type Provider } from '../db/types'
import { HIGHLIGHT_COLORS } from '../lib/highlights'
import { HOSTED_MODEL_LABEL, verifyKey } from '../lib/inference'
import { BackIcon } from '../components/Icons'
import KoreaderImport from '../components/KoreaderImport'
import Ornament from '../components/Ornament'
import { button, card, field, iconButton } from '../components/ui'

// Keep retired models listed: a stored value with no matching option renders the
// select blank, so anything a user might already have saved has to stay.
const MODELS = [
  { value: 'gpt-5.6-luna', label: 'gpt-5.6-luna — newest' },
  { value: 'gpt-5', label: 'gpt-5 — general purpose' },
  { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini — small and fast' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini — small and fast, older' },
  { value: 'gpt-4o', label: 'gpt-4o — older' },
]

const ISSUES_URL = 'https://github.com/critesjosh/marginalia/issues'
const DISCUSSIONS_URL = 'https://github.com/critesjosh/marginalia/discussions'
const CONTACT_EMAIL = 'rami@agenticpossible.com'

export default function SettingsPage() {
  const stored = useLiveQuery(() => getSettings(), [])
  const [apiKey, setApiKey] = useState('')
  const [dirtyKey, setDirtyKey] = useState(false)
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string>()

  const settings = stored ?? DEFAULT_SETTINGS

  useEffect(() => {
    if (stored && !dirtyKey) setApiKey(stored.apiKey ?? '')
  }, [stored, dirtyKey])

  async function testAndSave() {
    const key = apiKey.trim()
    if (!key) {
      await saveSettings({ apiKey: undefined })
      setStatus('idle')
      setMessage('Key cleared.')
      return
    }

    setStatus('checking')
    setMessage(undefined)
    try {
      await verifyKey(key, settings.model)
      await saveSettings({ apiKey: key })
      setDirtyKey(false)
      setStatus('ok')
      setMessage('Key works and is saved on this device.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Could not verify that key.')
    }
  }

  return (
    <div className="paper-grain min-h-full bg-paper text-ink">
      <header className="pt-safe sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
          <Link to="/" aria-label="Back to library" className={iconButton}>
            <BackIcon />
          </Link>
          <h1 className="font-book text-heading font-medium">Settings</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <section className={card}>
          <h2 className="font-book text-heading font-medium">Chat model</h2>
          <p className="mt-1 font-ui text-body text-ink-soft">
            Chat works out of the box — no account or key needed.
          </p>

          <div className="mt-3 space-y-2">
            <ProviderOption
              value="hosted"
              current={settings.provider}
              title="Built-in model"
              detail={`${HOSTED_MODEL_LABEL}. Free, and your key stays out of it — requests go through this site's relay.`}
            />
            <ProviderOption
              value="openai"
              current={settings.provider}
              title="My own OpenAI key"
              detail="Sends your conversations straight to api.openai.com, billed to you."
            />
          </div>
        </section>

        {settings.provider === 'openai' && (
          <>
            <section className={card}>
              <h2 className="font-book text-heading font-medium">OpenAI API key</h2>
              <p className="mt-1 font-ui text-body text-ink-soft">
                Stored only in this browser and sent only to api.openai.com. Don't use this on a
                shared device.
              </p>

              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setDirtyKey(true)
                  setStatus('idle')
                  setMessage(undefined)
                }}
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
                className={`${field} mt-3 font-mono text-[15px]`}
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => void testAndSave()}
                  disabled={status === 'checking'}
                  className={button.primary}
                >
                  {status === 'checking' ? 'Checking…' : 'Test and save'}
                </button>
                {message && (
                  <p
                    className={`font-ui text-meta ${status === 'error' ? 'text-danger' : 'text-moss'}`}
                  >
                    {message}
                  </p>
                )}
              </div>
            </section>

            <section className={card}>
              <h2 className="font-book text-heading font-medium">OpenAI models</h2>
              <select
                value={settings.model}
                onChange={(e) => void saveSettings({ model: e.target.value })}
                className={`${field} mt-2`}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <h3 className="mt-5 font-ui text-label font-medium">Summary model</h3>
              <p className="mt-1 font-ui text-body text-ink-soft">
                Used for the per-book memory digest. A cheap model is plenty.
              </p>
              <select
                value={settings.summaryModel}
                onChange={(e) => void saveSettings({ summaryModel: e.target.value })}
                className={`${field} mt-2`}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </section>
          </>
        )}

        <Ornament short />

        <section className={card}>
          <h2 className="font-book text-heading font-medium">Highlight color</h2>
          <p className="mt-1 font-ui text-body text-ink-soft">
            Used for every highlight, old and new.
          </p>
          <div role="radiogroup" aria-label="Highlight color" className="mt-3 flex gap-2">
            {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map((color) => {
              const selected = settings.highlightColor === color
              return (
                <button
                  key={color}
                  role="radio"
                  aria-checked={selected}
                  aria-label={color}
                  onClick={() => void saveSettings({ highlightColor: color })}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 transition ${
                    selected ? 'border-moss' : 'border-transparent'
                  }`}
                >
                  <span
                    style={{ background: HIGHLIGHT_COLORS[color] }}
                    className="block h-8 w-8 rounded-full ring-1 ring-ink/15"
                  />
                </button>
              )
            })}
          </div>
        </section>

        <section className={card}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={settings.spoilerGuard}
              onChange={(e) => void saveSettings({ spoilerGuard: e.target.checked })}
              className="mt-1 h-4 w-4 accent-moss"
            />
            <span>
              <span className="font-ui text-label font-medium">Avoid spoilers</span>
              <span className="mt-0.5 block font-ui text-meta text-ink-soft">
                Ask the model not to reveal anything past your current position unless you ask.
              </span>
            </span>
          </label>
        </section>

        <Ornament short />

        <section className={card}>
          <h2 className="font-book text-heading font-medium">Data</h2>
          <p className="mt-1 font-ui text-body text-ink-soft">
            Everything lives in this browser's IndexedDB. The export is a JSON file containing your
            highlighted passages and the surrounding text, every thread, and Rami's running notes on
            each book. It does not include your API key or the book files. Treat it as a record of
            what you read and thought.
          </p>
          <button onClick={() => void exportData()} className={`${button.secondary} mt-3`}>
            Export highlights and chats
          </button>
        </section>

        <KoreaderImport />

        <section className={card}>
          <h2 className="font-book text-heading font-medium">Feedback and community</h2>
          <p className="mt-1 font-ui text-body text-ink-soft">
            Share an idea or wander through other readers’ questions in the discussions. Something
            broken? Open an issue. Anything else, write to {CONTACT_EMAIL}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={DISCUSSIONS_URL} target="_blank" rel="noreferrer" className={button.secondary}>
              Join the discussion ↗
            </a>
            <a href={ISSUES_URL} target="_blank" rel="noreferrer" className={button.secondary}>
              Report an issue ↗
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className={button.secondary}>
              Email Rami
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

function ProviderOption({
  value,
  current,
  title,
  detail,
}: {
  value: Provider
  current: Provider
  title: string
  detail: string
}) {
  const selected = current === value

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors duration-150 ${
        selected ? 'border-moss bg-paper' : 'border-rule hover:bg-paper-sunk'
      }`}
    >
      <input
        type="radio"
        name="provider"
        value={value}
        checked={selected}
        onChange={() => void saveSettings({ provider: value })}
        className="mt-1 h-4 w-4 accent-moss"
      />
      <span>
        <span className="font-ui text-label font-medium">{title}</span>
        <span className="mt-0.5 block font-ui text-meta text-ink-soft">{detail}</span>
      </span>
    </label>
  )
}

async function exportData() {
  const [books, highlights, conversations, messages, bookMemory] = await Promise.all([
    db.books.toArray(),
    db.highlights.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.bookMemory.toArray(),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    // Blobs are dropped: this is a notes backup, not a library backup.
    books: books.map(({ file: _f, cover: _c, locations: _l, ...rest }) => rest),
    highlights,
    conversations,
    messages,
    bookMemory,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rami-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
