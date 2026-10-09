import garamondNormal from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url'
import garamondItalic from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2?url'
import literataNormal from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url'
import literataItalic from '@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url'
import charisNormal from '@fontsource/charis-sil/files/charis-sil-latin-400-normal.woff2?url'
import charisItalic from '@fontsource/charis-sil/files/charis-sil-latin-400-italic.woff2?url'
import charisBold from '@fontsource/charis-sil/files/charis-sil-latin-700-normal.woff2?url'
import charisBoldItalic from '@fontsource/charis-sil/files/charis-sil-latin-700-italic.woff2?url'
import type { ReaderFont, ReaderTheme } from '../db/types'

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

interface FontFile {
  url: string
  style: 'normal' | 'italic'
  /** A single weight, or a range for a variable font. */
  weight: string
}

export interface ReaderFontSpec {
  /** Reader-facing name. */
  label: string
  /** The `@font-face` family the files are registered under. */
  family: string
  /** The `font-family` stack, also used for the sample in Settings. */
  stack: string
  /** Body weight. Garamond's hairlines look spindly on screens at 400. */
  weight: number
  lineHeight: number
  files: FontFile[]
}

const SERIF_FALLBACK = "'Iowan Old Style', Palatino, Georgia, serif"

export const READER_FONTS: Record<ReaderFont, ReaderFontSpec> = {
  literata: {
    label: 'Literata',
    family: 'Literata Variable',
    stack: `'Literata Variable', ${SERIF_FALLBACK}`,
    weight: 400,
    lineHeight: 1.6,
    files: [
      { url: literataNormal, style: 'normal', weight: '200 900' },
      { url: literataItalic, style: 'italic', weight: '200 900' },
    ],
  },
  garamond: {
    label: 'EB Garamond',
    family: 'EB Garamond Variable',
    stack: `'EB Garamond Variable', ${SERIF_FALLBACK}`,
    weight: 500,
    lineHeight: 1.7,
    files: [
      { url: garamondNormal, style: 'normal', weight: '400 800' },
      { url: garamondItalic, style: 'italic', weight: '400 800' },
    ],
  },
  charis: {
    label: 'Charis SIL',
    family: 'Charis SIL',
    stack: `'Charis SIL', Charter, ${SERIF_FALLBACK}`,
    weight: 400,
    lineHeight: 1.6,
    files: [
      { url: charisNormal, style: 'normal', weight: '400' },
      { url: charisItalic, style: 'italic', weight: '400' },
      { url: charisBold, style: 'normal', weight: '700' },
      { url: charisBoldItalic, style: 'italic', weight: '700' },
    ],
  },
}

function fontFace(family: string, file: FontFile): Record<string, string> {
  const format = file.weight.includes(' ') ? 'woff2-variations' : 'woff2'
  return {
    'font-family': `'${family}'`,
    'font-style': file.style,
    'font-weight': file.weight,
    // The iframe has its own base URL, so the bundled font needs an absolute one.
    src: `url('${new URL(file.url, location.href).href}') format('${format}')`,
  }
}

/** Styles injected into the epub.js iframe for a given theme and font. */
export function epubThemeStyles(theme: ReaderTheme, font: ReaderFont) {
  const p = THEMES[theme]
  // A value this build does not know (say, from a newer one) gets the default.
  const f = READER_FONTS[font] ?? READER_FONTS.literata
  return {
    '@font-face': f.files.map((file) => fontFace(f.family, file)),
    body: {
      background: `${p.bg} !important`,
      color: `${p.fg} !important`,
      'font-family': `${f.stack} !important`,
      'font-weight': String(f.weight),
      'line-height': `${f.lineHeight} !important`,
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
