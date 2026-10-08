/** A section break: a gilt sprig between hairline rules, like a printer's fleuron. */
export default function Ornament({
  short,
  className = '',
}: {
  short?: boolean
  className?: string
}) {
  const rule = `h-px bg-rule ${short ? 'w-12' : 'flex-1'}`
  return (
    <div
      role="separator"
      className={`my-6 flex items-center gap-4 text-gilt ${short ? 'justify-center' : ''} ${className}`}
    >
      <span className={rule} />
      <Sprig className="h-[22px] w-[22px]" />
      <span className={rule} />
    </div>
  )
}

function Sprig({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        d="M11.6 22c.2-6 .5-12 1.6-19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path fill="currentColor" d="M11.7 17.2C8.2 17.6 5.6 15.6 5 12.6c3.2-.3 5.9 1.6 6.7 4.6Z" />
      <path fill="currentColor" d="M12 12.6c3.3-.1 5.9-2.3 6.3-5.3-3.2 0-5.8 2.2-6.3 5.3Z" />
      <path fill="currentColor" d="M12.4 8.2C9.6 8.1 7.6 6 7.4 3.4c2.7.1 4.8 2.1 5 4.8Z" />
    </svg>
  )
}
