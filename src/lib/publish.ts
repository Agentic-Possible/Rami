/**
 * Publishing a thread at an unlisted link (`shared/threads.ts` serves it).
 * Only the snapshot built here leaves the device: the book's title and author,
 * the chapter, the seed passage and the turns. Never the surrounding context,
 * memory, instructions or settings.
 */

import type { Book, Conversation, Message, PublishedLink } from '../db/types'

/** Mirrors the server's cap, so a long highlight is trimmed rather than refused. */
const MAX_PASSAGE_CHARS = 2_000

export interface ThreadSnapshot {
  book: { title: string; author: string }
  chapter?: string
  passage?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
}

type Published = Pick<PublishedLink, 'id' | 'url' | 'expiresAt'>

export class PublishError extends Error {}

export function snapshotFor(
  conversation: Pick<Conversation, 'chapter' | 'seedText'>,
  messages: Pick<Message, 'role' | 'content'>[],
  book: Pick<Book, 'title' | 'author'>,
): ThreadSnapshot {
  const passage = conversation.seedText?.trim()
  return {
    book: { title: book.title, author: book.author ?? '' },
    ...(conversation.chapter ? { chapter: conversation.chapter } : {}),
    ...(passage ? { passage: clamp(passage, MAX_PASSAGE_CHARS) } : {}),
    messages: messages.flatMap((message) =>
      message.role === 'system' ? [] : [{ role: message.role, content: message.content }],
    ),
  }
}

function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** Whether the thread has grown since it was last published. */
export function isStale(
  conversation: Pick<Conversation, 'published'>,
  messages: Pick<Message, 'createdAt'>[],
): boolean {
  const at = conversation.published?.publishedAt
  return at !== undefined && messages.some((message) => message.createdAt > at)
}

/** The Turnstile site key, or why publishing is unavailable. */
export async function publishSiteKey(fetcher: typeof fetch = fetch): Promise<string> {
  const body = await call<{ siteKey: string }>(fetcher, '/api/threads')
  return body.siteKey
}

export async function publishThread(
  snapshot: ThreadSnapshot,
  turnstileToken: string,
  fetcher: typeof fetch = fetch,
): Promise<Omit<PublishedLink, 'publishedAt'>> {
  return call(fetcher, '/api/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ thread: snapshot, turnstileToken }),
  })
}

export async function republishThread(
  id: string,
  ownerToken: string,
  snapshot: ThreadSnapshot,
  fetcher: typeof fetch = fetch,
): Promise<Published> {
  return call(fetcher, `/api/threads/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ thread: snapshot }),
  })
}

/** Resolves once the link is gone, including when it had already expired. */
export async function unpublishThread(
  id: string,
  ownerToken: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(`/api/threads/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ownerToken}` },
  }).catch(() => undefined)
  if (response && (response.ok || response.status === 404)) return
  throw new PublishError(await failure(response))
}

/**
 * Removes the links of conversations about to be deleted, since their owner
 * tokens go with them. Throws if any link could not be removed.
 */
export async function unpublishAll(
  conversations: Pick<Conversation, 'published'>[],
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await Promise.all(
    conversations.map(({ published }) =>
      published?.ownerToken
        ? unpublishThread(published.id, published.ownerToken, fetcher)
        : undefined,
    ),
  )
}

async function call<T>(fetcher: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, init).catch(() => undefined)
  if (!response?.ok) throw new PublishError(await failure(response))
  return (await response.json()) as T
}

async function failure(response: Response | undefined): Promise<string> {
  if (!response) return 'Could not reach Rami. Check your connection and try again.'
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: unknown }
  } | null
  const message = body?.error?.message
  return typeof message === 'string' ? message : `Publishing failed (status ${response.status}).`
}
