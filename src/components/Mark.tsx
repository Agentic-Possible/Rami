import { LOGO } from './logoPaths'

/** The branching r and its leaves, filled with `color`. Shared by Mark and Wordmark. */
export function MarkPaths({ color }: { color: string }) {
  return (
    <g fill={color}>
      <path d={LOGO.arm} />
      <path
        d={LOGO.stem}
        fill="none"
        stroke={color}
        strokeWidth={LOGO.stemWidth}
        strokeLinecap="round"
      />
      <path d={LOGO.leaves} />
    </g>
  )
}

/** The branching r alone, where the wordmark won't fit. One colour, 16px tall at least. */
export default function Mark({
  size = 32,
  color = 'var(--moss)',
  decorative,
  className,
}: {
  size?: number
  color?: string
  decorative?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox={LOGO.markViewBox}
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Rami'}
      aria-hidden={decorative || undefined}
    >
      <g transform="scale(1,-1)">
        <MarkPaths color={color} />
      </g>
    </svg>
  )
}
