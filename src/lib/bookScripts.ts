const XHTML_NS = 'http://www.w3.org/1999/xhtml'

/**
 * Blocks every script a book section could run, before epub.js renders it.
 *
 * The book frame has to allow scripts: WebKit, and so every iPad and iPhone
 * browser, never calls listeners the app adds to a frame sandboxed without
 * `allow-scripts`, so taps, long presses and selection all go dead. With
 * `allow-same-origin` beside it, a book script would run on this origin and
 * could read the API key and every conversation out of IndexedDB. This puts the
 * book's own code back out of reach.
 *
 * The policy is the guarantee; the rest is a second layer. Script elements are
 * kept with a type no browser runs, rather than removed, so element positions
 * and with them saved CFIs are unchanged.
 */
export function neutralizeScripts(doc: Document): void {
  const root = doc.documentElement
  if (!root) return

  let head = root.getElementsByTagNameNS('*', 'head')[0]
  if (!head) {
    // The HTML parser in the frame would add a head anyway, so CFIs agree.
    head = doc.createElementNS(XHTML_NS, 'head')
    root.insertBefore(head, root.firstChild)
  }

  // First in the head: a policy covers only what the parser meets after it.
  const policy = doc.createElementNS(XHTML_NS, 'meta')
  policy.setAttribute('http-equiv', 'Content-Security-Policy')
  policy.setAttribute('content', "script-src 'none'; object-src 'none'; frame-src 'none'")
  head.insertBefore(policy, head.firstChild)

  for (const script of Array.from(root.getElementsByTagNameNS('*', 'script'))) {
    script.setAttribute('type', 'text/plain')
    script.removeAttribute('src')
    script.removeAttribute('href')
    script.removeAttribute('xlink:href')
  }

  for (const element of Array.from(root.getElementsByTagName('*'))) {
    for (const { name } of Array.from(element.attributes)) {
      if (/^on/i.test(name)) element.removeAttribute(name)
    }
    // A refresh would navigate the frame to a raw book file that skipped this
    // pass, and the frame keeps its sandbox, scripts and all.
    if (element.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
      element.removeAttribute('http-equiv')
    }
  }
}
