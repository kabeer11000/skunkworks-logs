import type { ReactNode } from 'react'

const CHECK = (
  <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
    <path d="M6.5 12L2 7.5l1.5-1.5L6.5 9l6-6 1.5 1.5L6.5 12z" fill="currentColor" />
  </svg>
)

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center p-4">
      <div className="flex max-h-[700px] w-full max-w-6xl overflow-hidden rounded-2xl">
        {/* Left panel — branding, shared by Login and Onboarding */}
        <div className="hidden w-3/5 flex-col justify-between border-r bg-background p-12 md:flex">
          <div>
            <img src="/logo/skunkworks-transparent.png" className="h-10 w-10 rounded-lg bg-[var(--logo-chip)] p-1.5" alt="" />
            <h1 className="mt-8 max-w-md text-[2.75rem] font-bold leading-[1.1] tracking-tight">
              Every source drains into one log.
            </h1>
            <p className="mt-6 max-w-sm text-[0.8125rem] leading-relaxed text-muted-foreground">
              Commits, incidents, decisions, and AI summaries — everything that happens on a
              project, in one running log. Offline-first, synced everywhere.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
              {CHECK}
              Offline-first, syncs across every device
            </div>
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
              {CHECK}
              Private drains encrypted client-side
            </div>
            <div className="flex items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
              {CHECK}
              Built for agents too — MCP included
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex flex-1 items-center justify-center bg-background p-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 md:hidden">
              <img src="/logo/skunkworks-transparent.png" className="h-10 w-10 rounded-lg bg-[var(--logo-chip)] p-1.5" alt="" />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
