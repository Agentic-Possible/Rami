import { LOGO } from './logoPaths'
import { MarkPaths } from './Mark'

/** The lowercase wordmark: moss r, ink “ami”. Follows the theme. Once per screen. */
export default function Wordmark({ size = 28, mono }: { size?: number; mono?: boolean }) {
  return (
    <svg
      viewBox={LOGO.wordViewBox}
      className="flex-none"
      style={{ height: size, width: 'auto', display: 'block' }}
      role="img"
      aria-label="rami"
    >
      <g transform="scale(1,-1)">
        <MarkPaths color={mono ? 'var(--ink)' : 'var(--moss)'} />
        <g fill="var(--ink)">
          {LOGO.ami.map((glyph) => (
            <path key={glyph.x} transform={`translate(${glyph.x} 0)`} d={glyph.d} />
          ))}
        </g>
      </g>
    </svg>
  )
}
