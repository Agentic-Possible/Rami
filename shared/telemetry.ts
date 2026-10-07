export type Operation = 'app' | 'relay' | 'audiobooks'

export function operationMetric(operation: Operation, status: number, durationMs: number) {
  return {
    event: 'operation',
    operation,
    status,
    durationMs: Math.round(durationMs),
  }
}
