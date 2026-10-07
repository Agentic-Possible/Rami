/**
 * Runs the KOReader plugin's Lua specs under a Lua VM.
 *
 * Each spec asserts in Lua and ends by printing its own name; a failed
 * assertion raises, which `runSpec` rethrows with the Lua file and line.
 */
import { describe, expect, it } from 'vitest'
import { runSpec } from './harness.ts'

describe('koreader plugin', () => {
  it('builds the system prompt and holds the injection fence', async () => {
    expect(await runSpec('prompt_spec')).toContain('prompt_spec ok')
  })

  it('builds the handoff document with stable identities', async () => {
    expect(await runSpec('payload_spec')).toContain('payload_spec ok')
  })

  it('verifies certificate hostnames', async () => {
    expect(await runSpec('tls_spec')).toContain('tls_spec ok')
  })

  it('renders saved conversations back', async () => {
    expect(await runSpec('view_spec')).toContain('view_spec ok')
  })

  it('keeps the rolling digest bounded and unfenced', async () => {
    expect(await runSpec('digest_spec')).toContain('digest_spec ok')
  })

  it('decides what to fold into the digest', async () => {
    expect(await runSpec('memory_spec')).toContain('memory_spec ok')
  })
})
