import { useLiveQuery } from 'dexie-react-hooks'
import { getSettings } from '../db/db'
import type { Hint } from '../db/types'

/**
 * Whether the reader has yet to see `hint`. False until settings load, so a
 * returning reader never sees one flash past.
 */
export function useUnseenHint(hint: Hint): boolean {
  const seen = useLiveQuery(
    () => getSettings().then((settings) => settings.seenHints?.includes(hint) ?? false),
    [hint],
  )
  return seen === false
}
