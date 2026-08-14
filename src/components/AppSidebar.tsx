import { useEffect, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Globe, Lock, MoreHorizontal, Pencil, Trash2, Link, Inbox } from 'lucide-react'
import { $drains, populateDrains, deleteDrain } from '@/helpers/drains'
import { $identity, getStoredIdentityClient } from '@/services/identity'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import NewDrainDialog from './NewDrainDialog'
import RenameDrainDialog from './RenameDrainDialog'

const FOCUS_RING = 'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

interface Drain {
  dbName: string
  title: string
  description?: string
  tags?: string[]
  visibility: 'shared' | 'private'
  role: 'owner' | 'member'
}

function DrainCard({
  drain,
  active,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  drain: Drain
  active: boolean
  onEdit: (dbName: string) => void
  onDelete: (dbName: string) => void
  onCopyLink: (dbName: string) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const href = `/drains/${drain.dbName}`

  return (
    <a
      href={href}
      onContextMenu={(e) => {
        e.preventDefault()
        triggerRef.current?.click()
      }}
      className={`group relative flex flex-col gap-1 rounded-lg border p-3 transition-colors ${FOCUS_RING} ${
        active ? 'border-neutral-300 bg-secondary' : 'border-neutral-200 hover:bg-secondary/70'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{drain.title || 'Untitled'}</span>
        {drain.visibility === 'shared' ? (
          <Globe className="size-3 shrink-0 text-neutral-400 mt-0.5" />
        ) : (
          <Lock className="size-3 shrink-0 text-neutral-400 mt-0.5" />
        )}
      </div>

      {drain.description && (
        <p className="line-clamp-2 text-[0.6875rem] text-muted-foreground leading-snug">
          {drain.description}
        </p>
      )}

      {drain.tags && drain.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {drain.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {drain.tags.length > 3 && (
            <span className="text-[0.625rem] text-muted-foreground">+{drain.tags.length - 3}</span>
          )}
        </div>
      )}

      <span className="text-[0.6875rem] text-neutral-400">
        {drain.visibility === 'shared' ? 'Shared' : 'Private'}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              ref={triggerRef}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className={`absolute right-2 top-2 rounded p-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-neutral-100 transition-opacity ${FOCUS_RING}`}
            />
          }
        >
          <MoreHorizontal className="size-3.5 text-neutral-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(drain.dbName)}>
            <Pencil className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopyLink(drain.dbName)}>
            <Link className="size-3.5" />
            Copy link
          </DropdownMenuItem>
          {drain.role === 'owner' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(drain.dbName)}>
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </a>
  )
}

export default function AppSidebar() {
  const drains = useStore($drains)
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<{
    dbName: string
    title: string
    description?: string
    tags?: string[]
    visibility: 'shared' | 'private'
    isOwner: boolean
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ dbName: string; title: string } | null>(null)

  useEffect(() => {
    $identity.set(getStoredIdentityClient())
    populateDrains().finally(() => setLoading(false))
  }, [])

  const handleEdit = (dbName: string) => {
    const drain = $drains.get().find((d: any) => d.dbName === dbName)
    if (!drain) return
    setEditTarget({
      dbName,
      title: drain.title || '',
      description: drain.description,
      tags: drain.tags,
      visibility: drain.visibility,
      isOwner: drain.role === 'owner',
    })
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    await deleteDrain(deleteTarget.dbName)
    setDeleteTarget(null)
  }

  const handleCopyLink = (dbName: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/drains/${dbName}`)
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  return (
    <>
      <aside className="flex h-full w-[30%] flex-col rounded-xl bg-background">
        {/* Header */}
        <div className="relative flex h-14 shrink-0 items-center border-b px-4">
          <img src="/logo/skunkworks-transparent.png" className="h-6 w-6" alt="" />
          <a
            href="/"
            className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-transparent px-3 py-1.5 font-mono text-sm font-medium transition-colors hover:border-neutral-200 hover:bg-secondary ${FOCUS_RING}`}
          >
            skunkworks/logs
          </a>
          <div className="ml-auto">
            <NewDrainDialog />
          </div>
        </div>

        {/* Drains */}
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Drains
          </div>
          <div className="mb-3 text-xs text-neutral-400">Your personal engineering log</div>

          {loading ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[86px] w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {drains.map((drain: any) => {
                  const href = `/drains/${drain.dbName}`
                  return (
                    <DrainCard
                      key={drain.dbName}
                      drain={drain}
                      active={currentPath === href}
                      onEdit={handleEdit}
                      onDelete={(dbName) => setDeleteTarget({ dbName, title: drain.title || 'this drain' })}
                      onCopyLink={handleCopyLink}
                    />
                  )
                })}
              </div>
              {drains.length === 0 && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                    <Inbox className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No drains yet</p>
                  <p className="max-w-[180px] text-xs text-muted-foreground">
                    Create a drain to start logging your engineering work.
                  </p>
                  <div className="mt-2">
                    <NewDrainDialog />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Edit Dialog */}
      {editTarget && (
        <RenameDrainDialog
          drainId={editTarget.dbName}
          currentTitle={editTarget.title}
          currentDescription={editTarget.description}
          currentTags={editTarget.tags}
          visibility={editTarget.visibility}
          isOwner={editTarget.isOwner}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteConfirmed}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
