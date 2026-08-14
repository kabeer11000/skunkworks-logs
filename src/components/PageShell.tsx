import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import AppSidebar from './AppSidebar'

export default function PageShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div
          className="flex h-full flex-col overflow-auto"
          style={{ paddingInlineStart: 'var(--sidebar-width)' }}
        >
          <div className="flex items-center gap-2 p-2">
            <SidebarTrigger />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-3xl px-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
