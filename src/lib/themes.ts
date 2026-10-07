import type { ReaderTheme } from '../db/types'

export interface ThemePalette {
  /** Page background, applied to both the app chrome and the epub.js iframe. */
  bg: string
  fg: string
  muted: string
  link: string
  /** Tailwind classes for the surrounding reader chrome. */
  chrome: string
  chromeText: string
  border: string
}

export const THEMES: Record<ReaderTheme, ThemePalette> = {
  light: {
    bg: '#f7f4eb',
    fg: '#292924',
    muted: '#85837a',
    link: '#8a473a',
    chrome: 'bg-[#f7f4eb]',
    chromeText: 'text-[#292924]',
    border: 'border-[#e2ded2]',
  },
  sepia: {
    bg: '#eee5d2',
    fg: '#382f26',
    muted: '#86796b',
    link: '#8a473a',
    chrome: 'bg-[#eee5d2]',
    chromeText: 'text-[#382f26]',
    border: 'border-[#d9ccb4]',
  },
  dark: {
    bg: '#20231f',
    fg: '#d9d7cd',
    muted: '#8f9388',
    link: '#d39a85',
    chrome: 'bg-[#20231f]',
    chromeText: 'text-[#d9d7cd]',
    border: 'border-[#363a34]',
  },
}

/** Styles injected into the epub.js iframe for a given theme. */
export function epubThemeStyles(theme: ReaderTheme) {
  const p = THEMES[theme]
  return {
    body: {
      background: `${p.bg} !important`,
      color: `${p.fg} !important`,
      'font-family': "'Iowan Old Style', Palatino, Georgia, serif !important",
      'line-height': '1.7 !important',
      padding: '0 !important',
    },
    'p, li, div, span, td': { color: `${p.fg} !important` },
    'h1, h2, h3, h4, h5, h6': { color: `${p.fg} !important` },
    a: { color: `${p.link} !important` },
    'img, svg': { 'max-width': '100% !important', height: 'auto !important' },
    '::selection': { background: 'rgba(183, 150, 113, 0.35)' },
  }
}
