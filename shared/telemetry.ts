/**
 * Export a new allowlisted event. Never forward messages, breadcrumbs, request
 * URLs, user data, locals, book text, provider errors, or arbitrary tags.
 */
export function sanitizeErrorEvent(event: { event_id?: string; timestamp?: number }) {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    level: 'error' as const,
    exception: { values: [{ type: 'Error', value: 'Application operation failed' }] },
  }
}

export type Operation = 'app' | 'relay' | 'audiobooks'

export function operationMetric(operation: Operation, status: number, durationMs: number) {
  return {
    event: 'operation',
    operation,
    status,
    durationMs: Math.round(durationMs),
  }
}
