import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@nanostores/react'
import { Globe, Lock, MoreHorizontal, Pencil, Trash2, Link, Inbox, Download, Search, KeyRound } from 'lucide-react'
import { $commandPaletteOpen } from './CommandPalette'
import { RecentActivity } from './RecentActivity'
import { ApiTokensDialog } from './ApiTokensDialog'
import { exportDrainMarkdown } from '@/utils/exportDrain'
import { $drains, populateDrains, deleteDrain } from '@/helpers/drains'
import { $identity, getStoredIdentityClient } from '@/services/identity'
import { getAuthCredential } from '@/services/authSession'
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
import { AvatarGroup } from './AvatarGroup'
import { listDrainMembers } from '@/services/drainsApi'

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
  dimmed,
  onEdit,
  onDelete,
  onCopyLink,
}: {
  drain: Drain
  active: boolean
  dimmed: boolean
  onEdit: (dbName: string) => void
  onDelete: (dbName: string) => void
  onCopyLink: (dbName: string) => void
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const href = `/drains/${drain.dbName}`
  const [members, setMembers] = useState<string[]>([])

  useEffect(() => {
    if (drain.visibility !== 'shared') return
    listDrainMembers(drain.dbName)
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [drain.dbName, drain.visibility])

  return (
    <a
      href={href}
      onContextMenu={(e) => {
        e.preventDefault()
        triggerRef.current?.click()
      }}
      className={`group relative mb-2 flex flex-col gap-1 break-inside-avoid rounded-lg border p-3 transition-opacity transition-colors ${FOCUS_RING} ${
        active ? 'border-neutral-300 bg-secondary' : 'border-neutral-200 hover:bg-secondary/70'
      } ${dimmed ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
          {drain.title || 'Untitled'}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {drain.visibility === 'shared' ? (
            <Globe className="size-3.5 text-neutral-400" />
          ) : (
            <Lock className="size-3.5 text-neutral-400" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  ref={triggerRef}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  className={`rounded p-1 hover:bg-neutral-100 ${FOCUS_RING}`}
                />
              }
            >
              <MoreHorizontal className="size-4 text-neutral-400" />
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
              <DropdownMenuItem onClick={() => exportDrainMarkdown(drain.dbName, drain.title || 'Untitled')}>
                <Download className="size-3.5" />
                Export as Markdown
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
        </div>
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

      <div className="flex items-end justify-between gap-1.5 pt-1">
        <span className="text-[0.6875rem] text-neutral-400">
          {drain.visibility === 'shared' ? 'Shared' : 'Private'}
        </span>
        {drain.visibility === 'shared' && <AvatarGroup emails={members} max={3} />}
      </div>
    </a>
  )
}

export default function AppSidebar() {
  const drains = useStore($drains)
  // View transitions remount this island on every navigation — if $drains
  // (a module-level nanostore) already has data from before, skip the
  // skeleton flash instead of forcing a loading state on every nav.
  const [loading, setLoading] = useState($drains.get().length === 0)
  const [editTarget, setEditTarget] = useState<{
    dbName: string
    title: string
    description?: string
    tags?: string[]
    visibility: 'shared' | 'private'
    isOwner: boolean
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ dbName: string; title: string } | null>(null)
  const [tokensOpen, setTokensOpen] = useState(false)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const d of drains) for (const t of d.tags || []) set.add(t)
    return Array.from(set).sort()
  }, [drains])

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  useEffect(() => {
    const identity = getStoredIdentityClient()
    $identity.set(identity)

    // The sk_identity cookie (checked server-side to decide whether to show
    // AuthGate at all) can outlive the sessionStorage credential the actual
    // API calls need — e.g. closing and reopening the browser clears
    // sessionStorage but not the year-long cookie. Without this check every
    // authenticated call below just throws "Not signed in" with no recourse.
    if (identity && !getAuthCredential()) {
      document.cookie = 'sk_identity=; path=/; max-age=0'
      window.location.href = '/'
      return
    }

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
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              title="Search (Ctrl/Cmd+K)"
              onClick={() => $commandPaletteOpen.set(true)}
              className={`flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
            >
              <Search className="size-4" />
            </button>
            <button
              type="button"
              title="API tokens"
              onClick={() => setTokensOpen(true)}
              className={`flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground ${FOCUS_RING}`}
            >
              <KeyRound className="size-4" />
            </button>
            <NewDrainDialog />
          </div>
        </div>

        <ApiTokensDialog open={tokensOpen} onOpenChange={setTokensOpen} />

        {/* Drains */}
        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Drains
          </div>
          <div className="mb-3 text-xs text-neutral-400">Your personal engineering log</div>

          {allTags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-2 py-0.5 text-[0.6875rem] transition-colors ${FOCUS_RING} ${
                    activeTags.has(tag)
                      ? 'border-neutral-800 bg-neutral-800 text-white'
                      : 'border-neutral-200 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="mt-3 columns-1 gap-2 sm:columns-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="mb-2 h-[86px] w-full break-inside-avoid rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 columns-1 gap-2 sm:columns-2">
                {drains.map((drain: any) => {
                  const href = `/drains/${drain.dbName}`
                  const dimmed = activeTags.size > 0 && !(drain.tags || []).some((t: string) => activeTags.has(t))
                  return (
                    <DrainCard
                      key={drain.dbName}
                      drain={drain}
                      active={currentPath === href}
                      dimmed={dimmed}
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

        <RecentActivity />

        {/* Animated dog sprite — bottom left, walk cycle in place. Sheet is
            an 11-row x 4-col grid of 128x128 frames (not a single vertical
            strip); row 0 is a clean 4-frame walk cycle. */}
        <div
          className="shrink-0"
          style={{
            width: 96,
            height: 96,
            marginLeft: 8,
            marginBottom: 4,
            backgroundImage: 'url(/dog-sprite.png)',
            backgroundSize: '384px 1056px',
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
            animation: 'dogWalkFrames 0.8s steps(4) infinite',
          }}
        />
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
