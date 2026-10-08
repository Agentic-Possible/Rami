import type { ReaderTheme } from '../db/types'
import { THEMES } from '../lib/themes'
import ReaderPanel from './ReaderPanel'
import Ribbon from './Ribbon'
import { TrashIcon } from './Icons'
import { button } from './ui'

const THEME_OPTIONS: ReaderTheme[] = ['light', 'sepia', 'dark']

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
  const sizeButton =
    'grid h-11 w-11 shrink-0 place-items-center rounded-md border border-rule-strong font-book text-ink transition-colors duration-150 hover:bg-paper-sunk disabled:opacity-45'

  return (
    <ReaderPanel
      label="Reader settings"
      eyebrow="Reading preferences"
      title="Display"
      onClose={onClose}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <Group label="Text size">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onChange({ fontSize: Math.max(MIN_FONT, fontSize - 10) })}
              disabled={fontSize <= MIN_FONT}
              aria-label="Smaller text"
              className={`${sizeButton} text-[15px]`}
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
              className="flex-1 accent-moss"
              aria-label="Text size"
            />
            <button
              onClick={() => onChange({ fontSize: Math.min(MAX_FONT, fontSize + 10) })}
              disabled={fontSize >= MAX_FONT}
              aria-label="Larger text"
              className={`${sizeButton} text-[21px]`}
            >
              A
            </button>
          </div>
        </Group>

        <Group label="Page color">
          {/* Each swatch shows the page itself, not a color name. */}
          <div className="flex gap-3" role="group" aria-label="Page color">
            {THEME_OPTIONS.map((option) => {
              const palette = THEMES[option]
              const selected = option === theme
              return (
                <button
                  key={option}
                  onClick={() => onChange({ theme: option })}
                  aria-pressed={selected}
                  className={`grid justify-items-center gap-2 font-ui text-meta ${
                    selected ? 'font-medium text-ink' : 'text-ink-soft'
                  }`}
                >
                  <span
                    style={{ background: palette.bg, color: palette.fg }}
                    className={`grid h-12 w-16 place-items-center rounded-md border border-rule-strong font-book text-[22px] ${
                      selected ? 'shadow-[0_0_0_2px_var(--paper-leaf),0_0_0_4px_var(--moss)]' : ''
                    }`}
                  >
                    Aa
                  </span>
                  {palette.label}
                </button>
              )
            })}
          </div>
        </Group>

        <Group label="Reading progress">
          <Ribbon progress={progress} />
        </Group>

        <Group label="This book">
          <button onClick={onRemoveBook} className={`${button.danger} w-full`}>
            <TrashIcon />
            Remove from library
          </button>
        </Group>
      </div>
    </ReaderPanel>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule p-6">
      <p className="eyebrow mb-4">{label}</p>
      {children}
    </div>
  )
}
