/** The name: the sprig, then “Rami” in Garamond italic. Once per screen. */
export default function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span
      style={{ fontSize: size }}
      className="inline-flex items-baseline gap-[0.18em] font-book leading-none font-medium tracking-[-0.005em] text-ink italic"
    >
      <span aria-hidden className="-translate-y-[0.04em] text-[0.82em] not-italic">
        🌿
      </span>
      Rami
    </span>
  )
}
