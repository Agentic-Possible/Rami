import { describe, expect, it } from 'vitest'
import { operationMetric, sanitizeErrorEvent } from './telemetry.ts'

describe('privacy allowlists', () => {
  it('drops every sensitive field rather than trying to redact arbitrary strings', () => {
    const unsafe = {
      event_id: 'synthetic-id',
      timestamp: 1,
      message: 'secret book text',
      request: { url: 'https://example.invalid/?signature=secret' },
      user: { email: 'private@example.invalid' },
      breadcrumbs: [{ message: 'Bearer secret' }],
      exception: {
        values: [{ value: 'secret', stacktrace: { frames: [{ vars: { token: 'secret' } }] } }],
      },
      extra: { apiKey: 'secret' },
    }
    const result = sanitizeErrorEvent(unsafe)
    expect(result.event_id).toBe('synthetic-id')
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(Object.keys(result)).toEqual(['type', 'event_id', 'timestamp', 'level', 'exception'])
  })

  it('metrics contain only fixed operation names and numeric measurements', () => {
    expect(operationMetric('relay', 503, 3.51)).toEqual({
      event: 'operation',
      operation: 'relay',
      status: 503,
      durationMs: 4,
    })
  })
})
