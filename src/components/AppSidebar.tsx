import { useEffect, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Globe, Lock, MoreHorizontal, Pencil, Trash2, Link } from 'lucide-react'
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
  id: string
  _id: string
  title: string | null
  description?: string
  tags?: string[]
  visibility: 'shared' | 'private'
  unlocked?: boolean
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
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onCopyLink: (id: string) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const shortId = drain.id.replace('notebook:', '')
  const href = `/drains/${shortId}`

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
        <span className="line-clamp-2 text-sm font-medium leading-snug">
          {drain.unlocked ? drain.title || 'Untitled' : 'Encrypted'}
        </span>
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
          <DropdownMenuItem onClick={() => onEdit(drain.id)}>
            <Pencil className="size-3.5" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onCopyLink(drain.id)}>
            <Link className="size-3.5" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(drain.id)}>
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </a>
  )
}

export default function AppSidebar() {
  const drains = useStore($drains)
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<{
    id: string
    title: string
    description?: string
    tags?: string[]
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  useEffect(() => {
    $identity.set(getStoredIdentityClient())
    populateDrains().finally(() => setLoading(false))
  }, [])

  const handleEdit = (drainId: string) => {
    const drain = $drains.get().find((d: any) => d._id === drainId)
    if (!drain) return
    setEditTarget({
      id: drainId,
      title: drain.title || '',
      description: drain.description,
      tags: drain.tags,
    })
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    await deleteDrain(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleCopyLink = (drainId: string) => {
    const shortId = drainId.replace('notebook:', '')
    navigator.clipboard.writeText(`${window.location.origin}/drains/${shortId}`)
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  return (
    <>
      <aside className="flex h-full w-[30%] flex-col rounded-xl bg-background">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <a href="/" className={`flex items-center gap-2 rounded-md ${FOCUS_RING}`}>
            <img src="/logo/skunkworks-transparent.png" className="h-7 w-7" alt="" />
            <span className="text-sm font-medium">SkunkWorks / Logs</span>
          </a>
          <NewDrainDialog />
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
                  const shortId = drain.id.replace('notebook:', '')
                  const href = `/drains/${shortId}`
                  return (
                    <DrainCard
                      key={drain.id}
                      drain={drain}
                      active={currentPath === href}
                      onEdit={handleEdit}
                      onDelete={(id) => setDeleteTarget({ id, title: drain.title || 'this drain' })}
                      onCopyLink={handleCopyLink}
                    />
                  )
                })}
              </div>
              {drains.length === 0 && (
                <p className="mt-4 text-center text-xs text-muted-foreground">No drains yet</p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Edit Dialog */}
      {editTarget && (
        <RenameDrainDialog
          drainId={editTarget.id}
          currentTitle={editTarget.title}
          currentDescription={editTarget.description}
          currentTags={editTarget.tags}
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
