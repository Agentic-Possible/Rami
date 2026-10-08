import { Suspense, type ReactNode } from 'react'

export default function Deferred({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-paper font-ui text-meta text-ink-soft">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
