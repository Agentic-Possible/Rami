import { useEffect } from 'react'

/**
 * Tints the browser and status bar to match the page while mounted, then puts
 * back the app-wide color from index.html. Without it a dark reader sits under
 * a light status bar on Android.
 */
export function useThemeColor(color: string): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const previous = meta.content
    meta.content = color
    return () => {
      meta.content = previous
    }
  }, [color])
}
