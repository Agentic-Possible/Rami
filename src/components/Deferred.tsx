import { Suspense, type ReactNode } from 'react'

export default function Deferred({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-paper text-sm text-muted">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
