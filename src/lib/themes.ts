import garamondNormal from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url'
import garamondItalic from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2?url'
import type { ReaderTheme } from '../db/types'

export interface ThemePalette {
  /** Reader-facing name. */
  label: string
  /** The Rami token set the reader chrome takes on, via `data-theme`. */
  dataTheme: 'paper' | 'sepia' | 'lamplight'
  /**
   * Raw page colors for places CSS variables cannot reach: the epub.js
   * iframe, the browser's theme color and the theme swatches.
   */
  bg: string
  fg: string
  link: string
}

export const THEMES: Record<ReaderTheme, ThemePalette> = {
  light: { label: 'Paper', dataTheme: 'paper', bg: '#f4ecda', fg: '#2b2219', link: '#8e3626' },
  sepia: { label: 'Sepia', dataTheme: 'sepia', bg: '#e9dcc0', fg: '#3a2e22', link: '#8e3626' },
  dark: {
    label: 'Lamplight',
    dataTheme: 'lamplight',
    bg: '#1d1813',
    fg: '#eee2c9',
    link: '#e0937a',
  },
}

function fontFace(url: string, style: string): Record<string, string> {
  return {
    'font-family': "'EB Garamond Variable'",
    'font-style': style,
    'font-weight': '400 800',
    // The iframe has its own base URL, so the bundled font needs an absolute one.
    src: `url('${new URL(url, location.href).href}') format('woff2-variations')`,
  }
}

/** Styles injected into the epub.js iframe for a given theme. */
export function epubThemeStyles(theme: ReaderTheme) {
  const p = THEMES[theme]
  return {
    '@font-face': [fontFace(garamondNormal, 'normal'), fontFace(garamondItalic, 'italic')],
    body: {
      background: `${p.bg} !important`,
      color: `${p.fg} !important`,
      'font-family':
        "'EB Garamond Variable', 'Iowan Old Style', Palatino, Georgia, serif !important",
      'line-height': '1.7 !important',
      'font-variant-ligatures': 'common-ligatures',
      padding: '0 !important',
    },
    'p, li, div, span, td': { color: `${p.fg} !important` },
    'h1, h2, h3, h4, h5, h6': { color: `${p.fg} !important` },
    a: { color: `${p.link} !important` },
    'img, svg': { 'max-width': '100% !important', height: 'auto !important' },
    '::selection': {
      background: theme === 'dark' ? 'rgba(214, 176, 102, 0.26)' : 'rgba(190, 146, 58, 0.3)',
    },
  }
}
