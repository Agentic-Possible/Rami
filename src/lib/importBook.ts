import { db, findRestorableMatch, restoreBook } from '../db/db'
import { parseEpubFile } from './epub'

/**
 * Stores an EPUB and returns the id of the book to open.
 *
 * Importing the same file as a book that was removed but kept, or whose EPUB
 * the browser lost, picks that book back up, rather than standing a second,
 * empty copy next to the notes it belongs to.
 *
 * Shared by every way a book can arrive — the file picker, the Gutenberg
 * catalog, and a link shared to the app — so all three land in one place.
 */
export async function importEpub(file: File): Promise<string> {
  const book = await parseEpubFile(file, file.name)

  const match = await findRestorableMatch(book)
  if (match) {
    await restoreBook(match.id, book)
    return match.id
  }

  await db.books.add(book)
  return book.id
}
