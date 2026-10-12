export type Operation = 'app' | 'relay' | 'threads'

export function operationMetric(operation: Operation, status: number, durationMs: number) {
  return {
    event: 'operation',
    operation,
    status,
    durationMs: Math.round(durationMs),
  }
}
