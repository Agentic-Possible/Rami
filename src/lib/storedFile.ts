import { db } from '../db/db'
import type { Book } from '../db/types'
import { readEpubCover } from './epub'
import { fetchSampleBook } from './sampleBook'

/**
 * WebKit keeps a stored Blob's bytes in a file beside the database, and on iOS
 * that file can go missing while the row survives. Reading the Blob then
 * rejects with this, worded "The object can not be found here."
 */
function isLostBlob(err: unknown): boolean {
  return (err as { name?: string } | undefined)?.name === 'NotFoundError'
}

/** Whether a stored Blob's bytes are gone. Any other read failure is not ours to judge. */
async function isLost(blob: Blob): Promise<boolean> {
  try {
    await blob.arrayBuffer()
    return false
  } catch (err) {
    if (isLostBlob(err)) return true
    throw err
  }
}

/**
 * Mends a book whose cover was lost. WebKit refuses to write a row that still
 * holds a lost Blob, so a lost EPUB beside it is recovered in the same write;
 * otherwise the EPUB's own cover stands in for the one that is gone.
 */
export async function repairLostCover(book: Book): Promise<void> {
  if (!book.cover || !(await isLost(book.cover))) return
  if (book.file && (await isLost(book.file))) {
    await recoverLostFile(book)
    return
  }
  await db.books.update(book.id, { cover: book.file && (await readEpubCover(book.file)) })
}

/** The EPUB's bytes, recovering them if they were lost. */
export async function readBookFile(stored: Book, file: Blob): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer()
  } catch (err) {
    if (!isLostBlob(err)) throw err
  }
  return recoverLostFile(stored)
}

/**
 * A bundled book is fetched again, as long as it is still the edition the
 * reading position and highlights were taken in. Anything else is shelved as
 * removed but kept, which is what it now is: importing the same EPUB again
 * matches it by fingerprint and puts the notes back with it.
 */
async function recoverLostFile(stored: Book): Promise<ArrayBuffer> {
  let sample: Book | undefined
  try {
    sample = await fetchSampleBook(stored.id)
  } catch {
    throw new Error(
      'This book could not be read from this device. Try again when you are online to download it again.',
    )
  }

  const coverLost = stored.cover ? await isLost(stored.cover) : false

  if (sample?.file && (!stored.fileHash || sample.fileHash === stored.fileHash)) {
    // A cover the reader chose is kept, unless it was lost too.
    await db.books.update(stored.id, {
      file: sample.file,
      fileHash: sample.fileHash,
      cover: stored.cover && !coverLost ? stored.cover : sample.cover,
    })
    return sample.file.arrayBuffer()
  }

  await db.books.update(stored.id, {
    archivedAt: Date.now(),
    file: undefined,
    ...(coverLost && { cover: undefined }),
  })
  throw new Error(
    'This book could not be read from this device. It is now under Removed books with its notes; import the EPUB again to keep reading.',
  )
}
