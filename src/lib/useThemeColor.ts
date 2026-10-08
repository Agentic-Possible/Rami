import { useEffect } from 'react'

/**
 * Tints the browser and status bar to match the page while mounted, then puts
 * back the app-wide colours from index.html. Without it a dark reader sits under
 * a light status bar on Android.
 */
export function useThemeColor(color: string): void {
  useEffect(() => {
    // index.html carries one per colour scheme; the page overrides both.
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    const previous = metas.map((meta) => meta.content)
    for (const meta of metas) meta.content = color
    return () => {
      metas.forEach((meta, i) => (meta.content = previous[i]))
    }
  }, [color])
}
