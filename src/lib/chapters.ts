import { EpubCFI, type Contents, type NavItem } from 'epubjs'

export interface ChapterAnchor {
  label: string
  href: string
  /** CFI of the anchor element, used to compare against the reading position. */
  cfi?: string
}

const cfiComparator = new EpubCFI()

export function normalizeHref(href: string): string {
  return href.split('#')[0].replace(/^\.?\//, '')
}

function sameDoc(a: string, b: string): boolean {
  return normalizeHref(a) === normalizeHref(b)
}

function labelOf(item: NavItem): string {
  return item.label?.trim() || 'Untitled'
}

function flattenToc(toc: NavItem[]): NavItem[] {
  const out: NavItem[] = []
  const walk = (items: NavItem[]) => {
    for (const item of items) {
      out.push(item)
      if (item.subitems?.length) walk(item.subitems)
    }
  }
  walk(toc)
  return out
}

/**
 * Builds the ordered list of TOC anchors inside one spine document.
 *
 * Many EPUBs (Project Gutenberg's especially) put the whole book in a single
 * XHTML file and split chapters with `#anchor` fragments, so matching the TOC on
 * document href alone would mark every chapter as current at once. Resolving
 * each anchor to a CFI lets the position be compared properly.
 *
 * Books split by size rather than by chapter carry a chapter across documents:
 * Gutenberg's Emerson ends one file on the "Self-Reliance" heading and runs the
 * essay on into the next, ahead of "Friendship". `spineIndex` lets the chapter
 * still open from an earlier document lead the list, so the text before this
 * document's first heading is not named after that heading.
 */
export function buildAnchors(
  toc: NavItem[],
  href: string,
  contents: Contents,
  spineIndex?: (href: string) => number | undefined,
): ChapterAnchor[] {
  const flat = flattenToc(toc).filter((item) => item.href)
  const candidates = flat.filter((item) => sameDoc(item.href, href))

  const anchors = candidates.map((item) => {
    const anchor: ChapterAnchor = {
      label: labelOf(item),
      href: item.href,
    }
    const hash = item.href.split('#')[1]
    if (!hash) return anchor
    try {
      const el =
        contents.document.getElementById(hash) ??
        contents.document.querySelector(`[name="${CSS.escape(hash)}"]`)
      if (el) anchor.cfi = contents.cfiFromNode(el)
    } catch {
      // Anchor missing or unaddressable; fall back to document-level matching.
    }
    return anchor
  })

  // An entry for the whole document already covers its start. An unresolved
  // fragment does not, so it must not stop the carry.
  if (candidates.some((item) => !item.href.includes('#'))) return anchors
  const carried = spineIndex && openChapter(flat, href, spineIndex)
  return carried ? [{ label: labelOf(carried), href: carried.href }, ...anchors] : anchors
}

/** The last TOC entry in the nearest earlier spine document that has one. */
function openChapter(
  items: NavItem[],
  href: string,
  spineIndex: (href: string) => number | undefined,
): NavItem | undefined {
  const here = spineIndex(href)
  if (here === undefined) return undefined
  let best: NavItem | undefined
  let bestIndex = -1
  for (const item of items) {
    const index = spineIndex(item.href)
    if (index !== undefined && index < here && index >= bestIndex) {
      best = item
      bestIndex = index
    }
  }
  return best
}

/** Picks the last anchor at or before the current position. */
export function chapterAt(anchors: ChapterAnchor[], cfi: string): ChapterAnchor | undefined {
  if (anchors.length === 0) return undefined
  if (anchors.length === 1) return anchors[0]

  let current: ChapterAnchor | undefined
  for (const anchor of anchors) {
    if (!anchor.cfi) {
      // An anchorless entry represents the document as a whole.
      current ??= anchor
      continue
    }
    try {
      if (cfiComparator.compare(anchor.cfi, cfi) <= 0) current = anchor
      else break
    } catch {
      // Incomparable CFIs (different spine positions); keep what we have.
    }
  }
  return current ?? anchors[0]
}
