import { Suspense, type ReactNode } from 'react'

export default function Deferred({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-stone-950 text-sm text-stone-500">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
