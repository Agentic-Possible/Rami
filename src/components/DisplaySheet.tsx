import type { ReaderTheme } from '../db/types'
import { THEMES } from '../lib/themes'
import ReaderPanel from './ReaderPanel'
import { MoonIcon, SunIcon, TrashIcon } from './Icons'

const THEME_OPTIONS: { value: ReaderTheme; label: string }[] = [
  { value: 'light', label: 'Paper' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'dark', label: 'Night' },
]

const MIN_FONT = 80
const MAX_FONT = 180

export default function DisplaySheet({
  theme,
  fontSize,
  progress,
  onChange,
  onRemoveBook,
  onClose,
}: {
  theme: ReaderTheme
  fontSize: number
  /** Whole-book progress, 0 to 100. */
  progress: number
  onChange: (patch: { theme?: ReaderTheme; fontSize?: number }) => void
  /** Opens the confirmation for taking this book out of the library. */
  onRemoveBook: () => void
  onClose: () => void
}) {
  const palette = THEMES[theme]
  const sizeButton = `grid h-11 w-11 shrink-0 place-items-center rounded-lg border font-serif transition hover:bg-current/5 disabled:opacity-30 ${palette.border}`

  return (
    <ReaderPanel
      theme={theme}
      label="Reader settings"
      eyebrow="Reading preferences"
      title="Display"
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Group label="Text size" border={palette.border}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ fontSize: Math.max(MIN_FONT, fontSize - 10) })}
              disabled={fontSize <= MIN_FONT}
              aria-label="Smaller text"
              className={`${sizeButton} text-sm`}
            >
              A
            </button>
            <input
              type="range"
              min={MIN_FONT}
              max={MAX_FONT}
              step={10}
              value={fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
              className="flex-1"
              style={{ accentColor: palette.link }}
              aria-label="Text size"
            />
            <button
              onClick={() => onChange({ fontSize: Math.min(MAX_FONT, fontSize + 10) })}
              disabled={fontSize >= MAX_FONT}
              aria-label="Larger text"
              className={`${sizeButton} text-lg`}
            >
              A
            </button>
          </div>
        </Group>

        <Group label="Appearance" border={palette.border}>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onChange({ theme: option.value })}
                aria-pressed={option.value === theme}
                style={{
                  background: THEMES[option.value].bg,
                  color: THEMES[option.value].fg,
                  borderColor: option.value === theme ? '#9b5b4c' : 'transparent',
                }}
                className="flex flex-col items-center gap-2 rounded-lg border-2 px-1 py-3.5 text-xs font-medium shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
              >
                {option.value === 'dark' ? <MoonIcon /> : <SunIcon />}
                {option.label}
              </button>
            ))}
          </div>
        </Group>

        <Group label="Reading progress" border={palette.border}>
          <div className="flex items-center gap-3">
            <span className="font-serif text-xl font-medium">{progress}%</span>
            <div className="h-[3px] flex-1 overflow-hidden rounded bg-current/12">
              <i
                className="block h-full"
                style={{ width: `${progress}%`, background: palette.link }}
              />
            </div>
          </div>
        </Group>

        <Group label="This book" border={palette.border}>
          <button
            onClick={onRemoveBook}
            className={`flex w-full items-center gap-2 rounded-lg border py-2.5 pl-3 text-sm font-medium text-[#b4483a] ${palette.border}`}
          >
            <TrashIcon className="h-4 w-4" />
            Remove from library
          </button>
        </Group>
      </div>
    </ReaderPanel>
  )
}

function Group({
  label,
  border,
  children,
}: {
  label: string
  border: string
  children: React.ReactNode
}) {
  return (
    <div className={`border-b p-6 ${border}`}>
      <p className="mb-4 text-[10px] font-semibold tracking-[0.12em] uppercase opacity-60">
        {label}
      </p>
      {children}
    </div>
  )
}
