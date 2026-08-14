import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from '@/components/ui/sidebar'
import { $drains, populateDrains } from '@/helpers/drains'
import { $identity, getStoredIdentityClient } from '@/services/identity'
import NewDrainDialog from './NewDrainDialog'

export default function AppSidebar() {
  const drains = useStore($drains)

  useEffect(() => {
    $identity.set(getStoredIdentityClient())
    populateDrains()
  }, [])

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="flex-row items-center justify-between px-4 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo/skunkworks-transparent.png" className="h-8 w-8" alt="" />
          <span className="font-semibold">SkunkWorks</span>
        </a>
        <NewDrainDialog />
      </SidebarHeader>
      <SidebarContent />
    </Sidebar>
  )
}
