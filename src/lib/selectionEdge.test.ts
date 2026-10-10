import { describe, expect, it } from 'vitest'
import { isTouchFirst } from './selectionEdge'

const device = (maxTouchPoints: number, queries: string[]) =>
  ({
    navigator: { maxTouchPoints },
    matchMedia: (query: string) => ({ matches: queries.includes(query) }),
  }) as unknown as Window

describe('isTouchFirst', () => {
  it('takes a coarse pointer as touch', () => {
    expect(isTouchFirst(device(5, ['(pointer: coarse)']))).toBe(true)
  })

  it('takes a touch screen with nothing that hovers as touch', () => {
    // Firefox for Android, on a phone whose screen also takes a stylus.
    expect(isTouchFirst(device(5, ['(pointer: fine)']))).toBe(true)
  })

  it('leaves a touch laptop to its mouse', () => {
    expect(isTouchFirst(device(10, ['(pointer: fine)', '(any-hover: hover)']))).toBe(false)
  })

  it('leaves a desktop without touch alone', () => {
    expect(isTouchFirst(device(0, ['(pointer: fine)', '(any-hover: hover)']))).toBe(false)
  })
})
