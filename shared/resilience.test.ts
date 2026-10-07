import { describe, expect, it } from 'vitest'
import { boundedText, CircuitBreaker } from './resilience.ts'

describe('resilience', () => {
  it('opens after repeated failures and recovers after cooldown', () => {
    const breaker = new CircuitBreaker(2, 100)
    breaker.record(503, 100)
    expect(breaker.available(100)).toBe(true)
    breaker.record(502, 100)
    expect(breaker.available(199)).toBe(false)
    expect(breaker.available(200)).toBe(true)
    breaker.record(503, 200)
    breaker.record(200, 201)
    expect(breaker.available(201)).toBe(true)
  })
  it('bounds chunked body bytes, not just declared length', async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('long'))
        controller.close()
      },
    })
    await expect(boundedText(new Response(body), 3)).rejects.toThrow(RangeError)
    expect(await boundedText(new Response('short'), 10)).toBe('short')
    expect(await boundedText(new Response(null), 10)).toBe('')
  })
})
