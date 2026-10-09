// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { Contents, NavItem } from 'epubjs'
import { buildAnchors, chapterAt } from './chapters'

// Gutenberg's Emerson (#16643): "Self-Reliance" heads the last line of h-0 and
// the essay runs on into h-1, ahead of the "Friendship" heading.
const SPINE = ['h-0.xhtml', 'h-1.xhtml', 'h-2.xhtml']
const TOC: NavItem[] = [
  { id: '1', label: 'COMPENSATION.[93]', href: 'h-0.xhtml#compensation' },
  { id: '2', label: 'SELF-RELIANCE', href: 'h-0.xhtml#self-reliance' },
  { id: '3', label: 'FRIENDSHIP.[278]', href: 'h-1.xhtml#friendship' },
  { id: '4', label: 'HEROISM[309]', href: 'h-1.xhtml#heroism' },
]

const BEFORE_FRIENDSHIP = 'epubcfi(/6/4!/4/2/1:0)'
const FRIENDSHIP_CFI = 'epubcfi(/6/4!/4/890)'
const HEROISM_CFI = 'epubcfi(/6/4!/4/1392)'

function contentsFor(ids: Record<string, string>): Contents {
  const document = window.document.implementation.createHTMLDocument('')
  for (const id of Object.keys(ids)) {
    const el = document.createElement('h2')
    el.id = id
    document.body.append(el)
  }
  return {
    document,
    cfiFromNode: (node: Element) => ids[node.id],
  } as unknown as Contents
}

const spineIndex = (href: string) => {
  const index = SPINE.indexOf(href.split('#')[0])
  return index < 0 ? undefined : index
}

describe('chapter labels across split documents', () => {
  const contents = contentsFor({ friendship: FRIENDSHIP_CFI, heroism: HEROISM_CFI })

  it('names the chapter carried over from an earlier document', () => {
    const anchors = buildAnchors(TOC, 'h-1.xhtml', contents, spineIndex)
    expect(chapterAt(anchors, BEFORE_FRIENDSHIP)?.label).toBe('SELF-RELIANCE')
    expect(chapterAt(anchors, FRIENDSHIP_CFI)?.label).toBe('FRIENDSHIP.[278]')
    expect(chapterAt(anchors, HEROISM_CFI)?.label).toBe('HEROISM[309]')
  })

  it('carries a chapter through a document with no headings of its own', () => {
    const anchors = buildAnchors(TOC, 'h-2.xhtml', contentsFor({}), spineIndex)
    expect(chapterAt(anchors, 'epubcfi(/6/6!/4/2/1:0)')?.label).toBe('HEROISM[309]')
  })

  it('leaves the first document without a carried chapter', () => {
    const anchors = buildAnchors(TOC, 'h-0.xhtml', contentsFor({}), spineIndex)
    expect(anchors.map((anchor) => anchor.label)).toEqual(['COMPENSATION.[93]', 'SELF-RELIANCE'])
  })

  it('carries over past a heading that cannot be resolved', () => {
    const toc = [...TOC, { id: '5', label: 'MISSING', href: 'h-1.xhtml#missing' }]
    const anchors = buildAnchors(toc, 'h-1.xhtml', contents, spineIndex)
    expect(chapterAt(anchors, BEFORE_FRIENDSHIP)?.label).toBe('SELF-RELIANCE')
  })

  it('does not carry over when an entry covers the whole document', () => {
    const toc = [...TOC, { id: '5', label: 'NOTES', href: 'h-2.xhtml' }]
    const anchors = buildAnchors(toc, 'h-2.xhtml', contentsFor({}), spineIndex)
    expect(anchors.map((anchor) => anchor.label)).toEqual(['NOTES'])
  })
})
