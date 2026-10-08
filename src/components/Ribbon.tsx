/** Reading progress: a gilt ribbon on a hairline track, with an optional rubric percentage. */
export default function Ribbon({
  progress,
  showPercent = true,
  className = '',
}: {
  /** 0 to 100. */
  progress: number
  showPercent?: boolean
  className?: string
}) {
  const percent = Math.max(0, Math.min(100, Math.round(progress)))
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
        className="h-[3px] flex-1 overflow-hidden rounded-sm bg-rule"
      >
        <span className="block h-full bg-gilt" style={{ width: `${percent}%` }} />
      </span>
      {showPercent && (
        <span className="min-w-[3ch] text-right font-ui text-caption font-medium text-rubric [font-variant-numeric:oldstyle-nums]">
          {percent}%
        </span>
      )}
    </div>
  )
}
