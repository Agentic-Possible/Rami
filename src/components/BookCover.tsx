import { useState } from 'react'
import type { Book } from '../db/types'
import { repairLostCover } from '../lib/storedFile'
import { useBlobUrl } from '../lib/useBlobUrl'

const CLOTHS = ['bg-cloth-moss', 'bg-cloth-oxblood', 'bg-cloth-navy', 'bg-cloth-umber']

/** Picked from the title, so a book keeps its cloth. */
function clothFor(title: string) {
  let hash = 0
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return CLOTHS[Math.abs(hash) % CLOTHS.length]
}

/**
 * A book's cover, or for one without art a clothbound board: gilt small caps
 * inside a blind-stamped double rule, with a hinge at the spine. Fills its
 * parent, which sets the 2:3 shape, radius and shadow.
 */
export default function BookCover({ book, compact }: { book: Book; compact?: boolean }) {
  const coverUrl = useBlobUrl(book.cover)
  // Safari can lose a stored image's bytes while keeping the record; the
  // board stands in rather than a broken-image glyph while the record is mended.
  const [brokenUrl, setBrokenUrl] = useState<string>()
  if (coverUrl && coverUrl !== brokenUrl) {
    return (
      <img
        src={coverUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          setBrokenUrl(coverUrl)
          void repairLostCover(book).catch(() => undefined)
        }}
      />
    )
  }
  return (
    <div
      style={{ fontSize: compact ? 11 : 15 }}
      className={`relative flex h-full flex-col items-center justify-center pt-[14%] pr-[12%] pb-[14%] pl-[16%] text-center text-cloth-lettering shadow-[inset_7px_0_0_rgba(0,0,0,0.14),inset_8px_0_0_rgba(255,255,255,0.06)] ${clothFor(book.title)}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[7%_7%_7%_11%] border border-current opacity-45 outline outline-current -outline-offset-[5px]"
      />
      <span
        lang="en"
        className="line-clamp-4 max-w-full font-book text-[clamp(12px,1.35em,22px)] leading-[1.1] font-medium tracking-[0.03em] [overflow-wrap:break-word] hyphens-auto lowercase [font-variant-caps:all-small-caps]"
      >
        {book.title}
      </span>
      <span aria-hidden className="my-[10%] h-px w-[28%] bg-current opacity-60" />
      <span className="line-clamp-2 font-book text-[0.82em] leading-[1.2] italic">
        {book.author}
      </span>
    </div>
  )
}
