// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { neutralizeScripts } from './bookScripts'

const parse = (xhtml: string) => new DOMParser().parseFromString(xhtml, 'application/xhtml+xml')

const SECTION = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>T</title><script src="a.js"></script>
<meta http-equiv="refresh" content="0;url=b.xhtml" />
<meta HTTP-EQUIV="Refresh" content="0;url=c.xhtml" /></head>
<body><p onclick="x()" class="keep">Text</p>
<SCRIPT TYPE="text/javascript">z()</SCRIPT>
<svg xmlns="http://www.w3.org/2000/svg"><script>y()</script></svg></body>
</html>`

describe('neutralizeScripts', () => {
  it('puts a script-blocking policy first in the head', () => {
    const doc = parse(SECTION)
    neutralizeScripts(doc)
    const first = doc.getElementsByTagName('head')[0].firstElementChild!
    expect(first.getAttribute('http-equiv')).toBe('Content-Security-Policy')
    expect(first.getAttribute('content')).toContain("script-src 'none'")
  })

  it('disarms scripts without moving any element', () => {
    const doc = parse(SECTION)
    const before = doc.getElementsByTagName('body')[0].getElementsByTagName('*').length
    neutralizeScripts(doc)
    const scripts = Array.from(doc.getElementsByTagName('*')).filter(
      (element) => element.localName.toLowerCase() === 'script',
    )
    expect(scripts).toHaveLength(3)
    for (const script of scripts) {
      // Exactly one attribute, so no leftover `TYPE` or `src` can win over it.
      expect(Array.from(script.attributes).map(({ name, value }) => `${name}=${value}`)).toEqual([
        'type=text/plain',
      ])
    }
    expect(doc.getElementsByTagName('body')[0].getElementsByTagName('*')).toHaveLength(before)
  })

  it('strips event handlers and refreshes but leaves other attributes', () => {
    const doc = parse(SECTION)
    neutralizeScripts(doc)
    const paragraph = doc.getElementsByTagName('p')[0]
    expect(paragraph.hasAttribute('onclick')).toBe(false)
    expect(paragraph.getAttribute('class')).toBe('keep')
    // XML keeps attribute case; the frame's HTML parser does not.
    const refresh = Array.from(doc.getElementsByTagName('meta')).filter((meta) =>
      Array.from(meta.attributes).some(
        (attribute) =>
          attribute.name.toLowerCase() === 'http-equiv' &&
          attribute.value.toLowerCase() === 'refresh',
      ),
    )
    expect(refresh).toHaveLength(0)
  })

  it('adds a head to a section without one', () => {
    const doc = parse('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>T</p></body></html>')
    neutralizeScripts(doc)
    expect(doc.documentElement.firstElementChild?.localName).toBe('head')
  })

  it('puts the policy ahead of a body that comes before the head', () => {
    const doc = parse(
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>T</p></body><head><title>T</title></head></html>',
    )
    neutralizeScripts(doc)
    const first = doc.documentElement.firstElementChild!
    expect(first.localName).toBe('head')
    expect(first.firstElementChild?.getAttribute('http-equiv')).toBe('Content-Security-Policy')
  })

  it('gives a document that is not HTML a head to carry the policy', () => {
    const doc = parse(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="x()"><rect width="1" height="1"/></svg>',
    )
    // epub.js serializes the root it cached before the hooks, not the document.
    const section = { contents: doc.documentElement }
    neutralizeScripts(doc, section)
    const root = doc.documentElement
    expect(root.localName).toBe('html')
    expect(section.contents).toBe(root)
    expect(root.firstElementChild?.firstElementChild?.getAttribute('http-equiv')).toBe(
      'Content-Security-Policy',
    )
    const svg = doc.getElementsByTagNameNS('http://www.w3.org/2000/svg', 'svg')[0]
    expect(svg.parentElement?.localName).toBe('body')
    expect(svg.hasAttribute('onload')).toBe(false)
  })

  it('strips handlers from the root element too', () => {
    const doc = parse(
      '<html xmlns="http://www.w3.org/1999/xhtml" onmouseover="x()"><head></head><body></body></html>',
    )
    neutralizeScripts(doc)
    expect(doc.documentElement.hasAttribute('onmouseover')).toBe(false)
  })
})
