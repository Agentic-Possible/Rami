/**
 * Offering to install Rami as an app. Chromium hands over a deferred
 * `beforeinstallprompt`; iOS has no such event, so it gets instructions for
 * Share › Add to Home Screen instead.
 */

/** Chromium's install event; not in the DOM lib. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOffer = 'prompt' | 'ios'

export interface InstallContext {
  standalone: boolean
  hasPrompt: boolean
  userAgent: string
  /** iPadOS reports itself as a Mac; touch points tell them apart. */
  maxTouchPoints: number
  dismissedAt?: number
  now: number
}

const DISMISS_KEY = 'rami.installDismissedAt'
/** "Not now" quiets the offer for a month rather than forever. */
export const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

export function installOffer(context: InstallContext): InstallOffer | undefined {
  if (context.standalone) return undefined
  if (context.dismissedAt !== undefined && context.now - context.dismissedAt < SNOOZE_MS) {
    return undefined
  }
  if (context.hasPrompt) return 'prompt'
  return isIos(context.userAgent, context.maxTouchPoints) ? 'ios' : undefined
}

export function isIos(userAgent: string, maxTouchPoints: number) {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

let deferred: InstallPromptEvent | undefined
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Call once at startup: the event can fire before the library has mounted. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = undefined
    notify()
  })
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function currentInstallContext(): InstallContext {
  return {
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    hasPrompt: deferred !== undefined,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    dismissedAt: readDismissedAt(),
    now: Date.now(),
  }
}

/** Shows the browser's own install dialog. The event can only be used once. */
export async function promptInstall() {
  const event = deferred
  if (!event) return
  deferred = undefined
  await event.prompt()
  await event.userChoice
  notify()
}

export function dismissInstall(now = Date.now()) {
  try {
    localStorage.setItem(DISMISS_KEY, String(now))
  } catch {
    // Storage blocked: the offer simply returns next visit.
  }
  notify()
}

function readDismissedAt() {
  try {
    const value = Number(localStorage.getItem(DISMISS_KEY))
    return value > 0 ? value : undefined
  } catch {
    return undefined
  }
}
