import type { ReactNode } from 'react'
import AppSidebar from './AppSidebar'
import { CommandPalette } from './CommandPalette'

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[oklch(0.93_0_0)] dark:bg-muted p-2 gap-2">
      <AppSidebar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-background">
        <div className="flex h-full min-h-0 flex-col">
          {children}
        </div>
      </main>
      <CommandPalette />
    </div>
  )
}
