// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { neutralizeScripts } from './bookScripts'

const parse = (xhtml: string) => new DOMParser().parseFromString(xhtml, 'application/xhtml+xml')

const SECTION = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>T</title><script src="a.js"></script>
<meta http-equiv="refresh" content="0;url=b.xhtml" /></head>
<body><p onclick="x()" class="keep">Text</p>
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
    const scripts = Array.from(doc.getElementsByTagNameNS('*', 'script'))
    expect(scripts).toHaveLength(2)
    for (const script of scripts) {
      expect(script.getAttribute('type')).toBe('text/plain')
      expect(script.hasAttribute('src')).toBe(false)
    }
    expect(doc.getElementsByTagName('body')[0].getElementsByTagName('*')).toHaveLength(before)
  })

  it('strips event handlers and refreshes but leaves other attributes', () => {
    const doc = parse(SECTION)
    neutralizeScripts(doc)
    const paragraph = doc.getElementsByTagName('p')[0]
    expect(paragraph.hasAttribute('onclick')).toBe(false)
    expect(paragraph.getAttribute('class')).toBe('keep')
    const refresh = Array.from(doc.getElementsByTagName('meta')).filter(
      (meta) => meta.getAttribute('http-equiv')?.toLowerCase() === 'refresh',
    )
    expect(refresh).toHaveLength(0)
  })

  it('adds a head to a section without one', () => {
    const doc = parse('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>T</p></body></html>')
    neutralizeScripts(doc)
    expect(doc.documentElement.firstElementChild?.localName).toBe('head')
  })
})
