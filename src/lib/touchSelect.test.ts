import { describe, expect, it } from 'vitest'
import { lineRects } from './touchSelect'

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect

const rangeOf = (rects: DOMRect[]) => ({ getClientRects: () => rects }) as unknown as Range

describe('lineRects', () => {
  it('drops the box of an element enclosing selected lines', () => {
    const paragraph = rect(0, 0, 400, 60)
    const lines = [rect(100, 0, 300, 20), rect(0, 20, 400, 20), rect(0, 40, 120, 20)]
    expect(lineRects(rangeOf([paragraph, ...lines]))).toEqual(lines)
  })

  it('keeps one of two identical boxes', () => {
    const line = rect(0, 0, 50, 20)
    expect(lineRects(rangeOf([line, rect(0, 0, 50, 20)]))).toEqual([line])
  })

  it('drops empty boxes', () => {
    const line = rect(0, 0, 50, 20)
    expect(lineRects(rangeOf([rect(10, 10, 0, 20), line]))).toEqual([line])
  })
})
