/**
 * A short local log of storage trouble, attached to an issue only when the
 * reader opens one from Settings and chooses to submit it.
 *
 * Kept in localStorage rather than IndexedDB: what it records is IndexedDB
 * losing data, so it should not live in the store under suspicion. Entries
 * name no book, title or note, only whether the book was bundled or imported.
 */

import { BUILD_ID } from './buildInfo'

const LOG_KEY = 'marginalia.diagnostics'
const BUILD_KEY = 'marginalia.lastBuild'
const MAX_ENTRIES = 50
/** GitHub rejects longer prefilled issue URLs. */
const MAX_URL_LENGTH = 8000

type BookKind = 'bundled' | 'imported'

export type DiagnosticEvent =
  | {
      type: 'lost-file'
      book: BookKind
      outcome: 'restored' | 'unrecoverable' | 'offline'
      coverLost: boolean
      /** Days since the book was last opened, or added if never opened. */
      idleDays: number
    }
  | { type: 'lost-cover'; book: BookKind; idleDays: number }
  | { type: 'app-updated'; from: string; to: string }

/** Each entry carries the build that was running when it was written. */
export type DiagnosticEntry = DiagnosticEvent & { at: string; build: string }

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

function defaultStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function readDiagnostics(store = defaultStore()): DiagnosticEntry[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(LOG_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]) : []
  } catch {
    return []
  }
}

export function logDiagnostic(
  event: DiagnosticEvent,
  store = defaultStore(),
  now = new Date(),
  build = BUILD_ID,
) {
  const entries = [...readDiagnostics(store), { ...event, at: now.toISOString(), build }]
  try {
    store?.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    // Storage blocked or full: the log is a convenience, never a reason to fail.
  }
}

/** Records a change of build since the last launch, so losses can be lined up with updates. */
export function noteBuild(build = BUILD_ID, store = defaultStore(), now = new Date()) {
  let previous: string | null | undefined
  try {
    previous = store?.getItem(BUILD_KEY)
    if (previous === build) return
    store?.setItem(BUILD_KEY, build)
  } catch {
    return
  }
  if (previous) logDiagnostic({ type: 'app-updated', from: previous, to: build }, store, now, build)
}

export function idleDays(
  book: { lastOpenedAt?: number; addedAt: number },
  now = Date.now(),
): number {
  return Math.round((now - (book.lastOpenedAt ?? book.addedAt)) / 8_640_000) / 10
}

export interface DiagnosticContext {
  /** The exact build serving the page when the report is made. */
  build: string
  userAgent: string
  standalone: boolean
  persisted?: boolean
  usageMb?: number
  quotaMb?: number
  books: { total: number; removed: number; missing: number }
}

function describeEntry(entry: DiagnosticEntry): string {
  const prefix = `${entry.at} [${entry.build}]`
  switch (entry.type) {
    case 'lost-file':
      return `${prefix} lost EPUB, ${entry.book}, ${entry.outcome}${entry.coverLost ? ', cover lost too' : ''}, idle ${entry.idleDays}d`
    case 'lost-cover':
      return `${prefix} lost cover, ${entry.book}, idle ${entry.idleDays}d`
    case 'app-updated':
      return `${prefix} app updated from ${entry.from}`
  }
}

function describeStorage(context: DiagnosticContext): string {
  let persisted = 'unknown'
  if (context.persisted !== undefined) persisted = context.persisted ? 'yes' : 'no'
  const usage =
    context.usageMb === undefined ? '' : `, ${context.usageMb} MB used of ${context.quotaMb} MB`
  return `persistent ${persisted}${usage}`
}

/** The prefilled issue body: room to describe the problem, then the log. */
export function issueBody(context: DiagnosticContext, entries: DiagnosticEntry[]): string {
  const { books } = context
  return [
    '**What happened?**',
    '',
    '',
    '<details><summary>Diagnostics (no book titles or notes)</summary>',
    '',
    `- Version: ${context.build}`,
    `- Browser: ${context.userAgent}`,
    `- Opened from: ${context.standalone ? 'home screen' : 'browser'}`,
    `- Storage: ${describeStorage(context)}`,
    `- Books: ${books.total} (${books.removed} removed, ${books.missing} missing their EPUB)`,
    '',
    '```',
    ...(entries.length ? entries.map(describeEntry) : ['No storage events recorded.']),
    '```',
    '</details>',
  ].join('\n')
}

/** A new-issue link with the body prefilled, dropping the oldest entries until it fits. */
export function issueUrl(
  issuesUrl: string,
  context: DiagnosticContext,
  entries: DiagnosticEntry[],
): string {
  for (let start = 0; ; start++) {
    const url = `${issuesUrl}/new?body=${encodeURIComponent(issueBody(context, entries.slice(start)))}`
    if (url.length <= MAX_URL_LENGTH || start >= entries.length) return url
  }
}
