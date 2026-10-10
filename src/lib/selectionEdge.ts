import type { Contents } from 'epubjs'

/** Fraction of the page width at each side where a tap turns the page. */
export const TAP_TURN_ZONE = 0.28
/** Narrowest band along each page edge that turns the page while selecting. */
const MIN_EDGE_PX = 12
/** How long a dragging selection must rest at an edge before the page turns. */
const EDGE_DWELL_MS = 600

export type PageDirection = 'next' | 'prev'
export type TurnPage = (direction: PageDirection) => Promise<unknown> | void

/**
 * Whether presses on the book are touches, read as taps and long presses. A
 * coarse pointer says so, and so does a touch screen with nothing that hovers:
 * Firefox for Android calls a phone whose screen also takes a stylus a fine
 * pointer.
 */
export function isTouchFirst(win: Window): boolean {
  const matches = (query: string) => win.matchMedia?.(query).matches ?? false
  return (
    matches('(pointer: coarse)') ||
    (win.navigator.maxTouchPoints > 0 && !matches('(any-hover: hover)'))
  )
}

interface EdgeTurner {
  /** Reports the dragging point, in the book frame's client coordinates. */
  track: (clientX: number, clientY: number) => void
  stop: () => void
}

/**
 * Turns the page under a selection that is dragged to the edge of the page.
 *
 * epub.js lays a section out as one wide strip and shows a page-sized window
 * of it, so the text a selection should run on into is already in the
 * document, just scrolled out of reach of the finger or mouse. Resting in the
 * page's right margin turns forward, the left margin back, and the selection is
 * then extended to the same point on the new page. The margins, not a fixed
 * band, because text runs right up to them: a pointer still on the end of a
 * line must not turn the page. There is no top or bottom margin to use, so the
 * edges are the sides only. A section's first and last page stop there: the
 * next section is another document, which a selection cannot reach.
 */
export function edgeTurner(doc: Document, turn: TurnPage): EdgeTurner {
  let timer = 0
  let armed: PageDirection | undefined
  // Host-viewport coordinates, which stay put while the page scrolls under them.
  let point: { x: number; y: number } | undefined

  const frame = () => doc.defaultView?.frameElement as HTMLElement | null | undefined
  const scroller = () => frame()?.closest('.epub-container') as HTMLElement | null | undefined

  const directionAt = (x: number): PageDirection | undefined => {
    const page = scroller()?.getBoundingClientRect()
    if (!page) return undefined
    const style = window.getComputedStyle(doc.body)
    const right = Math.max(MIN_EDGE_PX, parseFloat(style.paddingRight) || 0)
    const left = Math.max(MIN_EDGE_PX, parseFloat(style.paddingLeft) || 0)
    if (x > page.right - right) return 'next'
    if (x < page.left + left) return 'prev'
    return undefined
  }

  const canTurn = (direction: PageDirection) => {
    const el = scroller()
    if (!el) return false
    if (direction === 'prev') return el.scrollLeft > 1
    return el.scrollLeft + el.clientWidth < el.scrollWidth - 1
  }

  const clear = () => {
    window.clearTimeout(timer)
    timer = 0
    armed = undefined
  }

  const extendTo = (x: number, y: number) => {
    const offset = frame()?.getBoundingClientRect()
    const page = scroller()?.getBoundingClientRect()
    if (!offset || !page) return
    // A pointer past the page edge would otherwise reach into the next column.
    const px = Math.min(Math.max(x, page.left + 1), page.right - 1)
    const py = Math.min(Math.max(y, page.top + 1), page.bottom - 1)
    const caret = caretAt(doc, px - offset.left, py - offset.top)
    if (caret) doc.getSelection()?.extend(caret.node, caret.offset)
  }

  const fire = async (direction: PageDirection) => {
    timer = 0
    const selection = doc.getSelection()
    if (!selection || selection.isCollapsed || !canTurn(direction)) return
    await turn(direction)
    // Let the scroll land before reading the frame's new offset.
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
    if (!point || armed !== direction) return
    extendTo(point.x, point.y)
    // Still resting at the edge: keep turning.
    timer = window.setTimeout(() => void fire(direction), EDGE_DWELL_MS)
  }

  return {
    track(clientX, clientY) {
      const offset = frame()?.getBoundingClientRect()
      if (!offset) return
      point = { x: clientX + offset.left, y: clientY + offset.top }
      const direction = directionAt(point.x)
      if (direction === armed) return
      clear()
      if (!direction) return
      armed = direction
      // The host window's timer: the book frame's may never run (see touchSelect).
      timer = window.setTimeout(() => void fire(direction), EDGE_DWELL_MS)
    },
    stop() {
      clear()
      point = undefined
    },
  }
}

/**
 * Edge turning for a mouse drag-selection. The selection itself stays native;
 * this only watches the drag. Touch selection drives `edgeTurner` itself.
 */
export function mouseEdgeTurn(contents: Contents, turn: TurnPage): () => void {
  const doc = contents.document
  const win = contents.window
  if (!doc || !win || isTouchFirst(win)) return () => {}

  const turner = edgeTurner(doc, turn)
  const onMove = (event: MouseEvent) => {
    const selection = doc.getSelection()
    if (event.buttons & 1 && selection && !selection.isCollapsed) {
      turner.track(event.clientX, event.clientY)
    } else turner.stop()
  }
  const onUp = () => turner.stop()

  doc.addEventListener('mousemove', onMove)
  doc.addEventListener('mouseup', onUp)
  return () => {
    turner.stop()
    doc.removeEventListener('mousemove', onMove)
    doc.removeEventListener('mouseup', onUp)
  }
}

interface Caret {
  node: Node
  offset: number
}

export function caretAt(doc: Document, x: number, y: number): Caret | undefined {
  const api = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  const range = api.caretRangeFromPoint?.(x, y)
  if (range) return { node: range.startContainer, offset: range.startOffset }

  const position = api.caretPositionFromPoint?.(x, y)
  if (position) return { node: position.offsetNode, offset: position.offset }

  return undefined
}
