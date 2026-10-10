import type { Contents } from 'epubjs'
import { caretAt, edgeTurner, isTouchFirst, type TurnPage } from './selectionEdge'

/**
 * How long a finger must rest before a press means "select this word".
 *
 * Deliberately longer than the roughly half a second at which Android decides
 * on its own -- that threshold is what a resting thumb keeps tripping, and
 * matching it would give the reader nothing back.
 */
export const LONG_PRESS_MS = 650
/** Movement that makes a press a swipe rather than a selection. */
export const MOVE_TOLERANCE_PX = 10

/** On the book's root while touch selection is drawn by `longPressToSelect`. */
export const DRAWN_SELECTION_CLASS = 'marginalia-drawn-selection'
/** One box of the drawn selection; the theme gives it its color. */
export const SELECTION_MARK_CLASS = 'marginalia-selection-mark'

const XHTML_NS = 'http://www.w3.org/1999/xhtml'

/**
 * Replaces the browser's own touch text-selection with an explicit long press.
 *
 * Android starts selecting at roughly half a second of contact, which is well
 * inside what a reader means by "tap to turn the page": a thumb that lingers
 * pops the system selection bar and the page never turns. Marking the text
 * unselectable takes that decision away from the browser, and this handler hands
 * it back on a press the reader clearly meant.
 *
 * The selection is written straight into the document rather than reported
 * upwards. epub.js listens for `selectionchange` on the same document and turns
 * it into the `selected` event with a CFI range, so a programmatic selection
 * reaches the app through exactly the path a native one does.
 *
 * iOS does not paint a selection made this way, so the reader would drag
 * through text with nothing showing. The selection is therefore drawn here, and
 * the theme hides the native paint so Android does not show it twice.
 *
 * `isClaimed` reports whether something else, a tap on a highlight say, took
 * over a press that started at the given time; that press selects nothing.
 *
 * Touch screens only (see `isTouchFirst`). Dragging a mouse to select is
 * unambiguous, so on desktop the native behavior is left alone.
 *
 * Dragging the selection to the edge of the page turns it (see `edgeTurner`),
 * so a passage can be selected across a page break.
 */
export function longPressToSelect(
  contents: Contents,
  turn: TurnPage,
  isClaimed: (pressStartedAt: number) => boolean = () => false,
): () => void {
  const doc = contents.document
  const win = contents.window
  if (!doc?.body || !win) return () => {}
  if (!isTouchFirst(win)) return () => {}

  const body = doc.body
  const setSelectable = (on: boolean) => {
    const value = on ? 'text' : 'none'
    body.style.setProperty('-webkit-user-select', value, 'important')
    body.style.setProperty('user-select', value, 'important')
  }

  // The callout is the long-press "copy / search" bubble; ours replaces it.
  body.style.setProperty('-webkit-touch-callout', 'none', 'important')
  setSelectable(false)
  const detachDrawing = drawSelection(doc, win)

  let timer = 0
  let origin: { x: number; y: number; at: number } | undefined
  let selecting = false
  const turner = edgeTurner(doc, turn)

  // Deliberately the host window's timer, not the book frame's: a frame's
  // window is replaced whenever its section is, and WebKit runs nothing for a
  // frame sandboxed without `allow-scripts`.
  const disarm = () => {
    window.clearTimeout(timer)
    timer = 0
    origin = undefined
  }

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (event.touches.length !== 1 || !touch) {
      // A second finger means a pinch, not a press. Drop out of selecting too,
      // or the zoom gesture would drag the selection along with it.
      selecting = false
      turner.stop()
      disarm()
      return
    }

    // A press that starts on top of a live selection is the reader grabbing a
    // drag handle or dismissing it, so leave the document selectable for it.
    const selection = win.getSelection()
    if (!selection || selection.isCollapsed) setSelectable(false)

    selecting = false
    origin = { x: touch.clientX, y: touch.clientY, at: Date.now() }
    timer = window.setTimeout(() => {
      if (!origin || isClaimed(origin.at)) return
      selecting = selectWordAt(doc, win, origin.x, origin.y, setSelectable)
    }, LONG_PRESS_MS)
  }

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return

    if (selecting) {
      // Past the long press the finger extends the selection, so the page must
      // not also scroll under it.
      event.preventDefault()
      const caret = caretAt(doc, touch.clientX, touch.clientY)
      if (caret) win.getSelection()?.extend(caret.node, caret.offset)
      turner.track(touch.clientX, touch.clientY)
      return
    }

    if (!origin) return
    const moved =
      Math.abs(touch.clientX - origin.x) > MOVE_TOLERANCE_PX ||
      Math.abs(touch.clientY - origin.y) > MOVE_TOLERANCE_PX
    if (moved) disarm()
  }

  const onTouchEnd = (event: TouchEvent) => {
    // A long press has already put a selection on screen. Letting the browser
    // synthesise the trailing mousedown would collapse it again, and the click
    // behind it would reach the page-turn handler with nothing left to veto it.
    if (selecting) event.preventDefault()
    turner.stop()
    disarm()
  }

  doc.addEventListener('touchstart', onTouchStart, { passive: true })
  doc.addEventListener('touchmove', onTouchMove, { passive: false })
  doc.addEventListener('touchend', onTouchEnd, { passive: false })
  doc.addEventListener('touchcancel', onTouchEnd, { passive: false })

  return () => {
    turner.stop()
    disarm()
    doc.removeEventListener('touchstart', onTouchStart)
    doc.removeEventListener('touchmove', onTouchMove)
    doc.removeEventListener('touchend', onTouchEnd)
    doc.removeEventListener('touchcancel', onTouchEnd)
    body.style.removeProperty('-webkit-touch-callout')
    setSelectable(true)
    detachDrawing()
  }
}

/**
 * Draws the document's selection as boxes over the text, following every change.
 *
 * The boxes sit in a fixed layer on the root, outside the body, so they share
 * the frame's coordinates without moving any element a CFI counts.
 */
function drawSelection(doc: Document, win: Window): () => void {
  const root = doc.documentElement
  const layer = doc.createElementNS(XHTML_NS, 'div') as HTMLDivElement
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:2147483647;margin:0;padding:0'
  root.appendChild(layer)
  root.classList.add(DRAWN_SELECTION_CLASS)

  const draw = () => {
    layer.replaceChildren()
    const selection = win.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return
    for (const rect of lineRects(selection.getRangeAt(0))) {
      const mark = doc.createElementNS(XHTML_NS, 'div') as HTMLDivElement
      mark.className = SELECTION_MARK_CLASS
      mark.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`
      layer.appendChild(mark)
    }
  }

  doc.addEventListener('selectionchange', draw)
  return () => {
    doc.removeEventListener('selectionchange', draw)
    layer.remove()
    root.classList.remove(DRAWN_SELECTION_CLASS)
  }
}

/**
 * The range's boxes, less any that enclose another: a range reports the whole
 * box of every element it fully covers alongside the lines of text inside it.
 */
export function lineRects(range: Range): DOMRect[] {
  const encloses = (outer: DOMRect, inner: DOMRect) =>
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom

  // Identical boxes enclose each other, so drop repeats first or both would go.
  const rects = Array.from(range.getClientRects()).filter(
    (rect, i, all) =>
      rect.width > 0 &&
      rect.height > 0 &&
      all.findIndex((other) => encloses(rect, other) && encloses(other, rect)) === i,
  )
  return rects.filter((outer) => !rects.some((inner) => inner !== outer && encloses(outer, inner)))
}

/** Selects the whitespace-delimited word under a point. */
function selectWordAt(
  doc: Document,
  win: Window,
  x: number,
  y: number,
  setSelectable: (on: boolean) => void,
): boolean {
  const caret = caretAt(doc, x, y)
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return false

  const text = caret.node.textContent ?? ''
  let from = Math.min(caret.offset, text.length)
  let to = from
  while (from > 0 && !/\s/.test(text[from - 1])) from--
  while (to < text.length && !/\s/.test(text[to])) to++
  if (from === to) return false

  // Blink refuses to select through the Selection API while the text is marked
  // unselectable, so lift it first and leave it lifted for the drag that follows.
  setSelectable(true)

  const range = doc.createRange()
  range.setStart(caret.node, from)
  range.setEnd(caret.node, to)

  const selection = win.getSelection()
  if (!selection) return false
  selection.removeAllRanges()
  selection.addRange(range)
  return true
}
