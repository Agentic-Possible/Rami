import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Book } from '../db/types'
import { buildSystemPrompt } from './prompt'

const BOOK = { title: 'Moby-Dick', author: 'Herman Melville' } as Book

function voiceLines(prompt: string): string[] {
  const section = prompt.split('## Voice\n')[1].split('\n\n')[0]
  return section.split('\n')
}

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt({
    book: BOOK,
    conversation: { seedText: 'Call me Ishmael.' },
    spoilerGuard: false,
  })

  it('sets the reply voice from the design system', () => {
    expect(prompt).toContain('## Voice')
    expect(prompt).toContain('Write prose. Use lists or headings only if the reader asks for them.')
    expect(prompt).toContain(
      'Do not add a closing question or suggest what to explore next unless they ask.',
    )
    expect(prompt).toContain('No emoji.')
  })

  it('keeps the voice section mirrored in the KOReader prompt', () => {
    const lua = readFileSync('koreader/marginalia.koplugin/marginalia_prompt.lua', 'utf8')
    for (const line of voiceLines(prompt)) {
      expect(lua).toContain(`"${line}",`)
    }
  })
})
