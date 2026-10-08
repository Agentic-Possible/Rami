/** Best-effort isolate-local breaker. No prompts, IPs, or request data are retained. */
export class CircuitBreaker {
  private failures = 0
  private openedAt = 0
  private readonly threshold: number
  private readonly cooldownMs: number

  constructor(threshold = 5, cooldownMs = 30_000) {
    this.threshold = threshold
    this.cooldownMs = cooldownMs
  }

  available(now = Date.now()): boolean {
    if (this.failures < this.threshold) return true
    if (now - this.openedAt < this.cooldownMs) return false
    this.failures = 0
    return true
  }

  record(status: number, now = Date.now()): void {
    if (status >= 500 || status === 429) {
      this.failures++
      if (this.failures === this.threshold) this.openedAt = now
    } else this.failures = 0
  }
}

/** Bounds even chunked bodies; Content-Length alone cannot enforce this limit. */
export async function boundedText(response: Request | Response, limit: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let total = 0
  let result = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return result + decoder.decode()
      total += value.byteLength
      if (total > limit) throw new RangeError('Body limit exceeded')
      result += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
