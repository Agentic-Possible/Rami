import { describe, expect, it } from 'vitest'
import { operationMetric } from './telemetry.ts'

describe('operation metrics', () => {
  it('metrics contain only fixed operation names and numeric measurements', () => {
    expect(operationMetric('relay', 503, 3.51)).toEqual({
      event: 'operation',
      operation: 'relay',
      status: 503,
      durationMs: 4,
    })
  })
})
