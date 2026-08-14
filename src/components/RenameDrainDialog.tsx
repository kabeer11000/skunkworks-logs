import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateDrainMeta } from '@/helpers/drains'
import { populateDrains } from '@/helpers/drains'
import { listDrainMembers, inviteToDrain, removeDrainMemberApi } from '@/services/drainsApi'
import { $identity } from '@/services/identity'
import { X } from 'lucide-react'

interface EditDrainDialogProps {
  drainId: string
  currentTitle: string
  currentDescription?: string
  currentTags?: string[]
  visibility: 'private' | 'shared'
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RenameDrainDialog({
  drainId,
  currentTitle,
  currentDescription = '',
  currentTags = [],
  visibility,
  isOwner,
  open,
  onOpenChange,
}: EditDrainDialogProps) {
  const [title, setTitle] = useState(currentTitle)
  const [description, setDescription] = useState(currentDescription)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(currentTags)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [members, setMembers] = useState<string[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    if (!open || visibility !== 'shared') return
    listDrainMembers(drainId).then(setMembers).catch(() => setMembers([]))
  }, [open, drainId, visibility])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle(currentTitle)
      setDescription(currentDescription)
      setTags(currentTags)
      setTagInput('')
      setError('')
      setInviteEmail('')
      setInviteError('')
    }
    onOpenChange(next)
  }

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t))

  const handleSave = async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Title cannot be empty')
      return
    }
    setLoading(true)
    setError('')
    try {
      await updateDrainMeta(
        drainId,
        trimmed,
        description.trim() || undefined,
        tags.length ? tags : undefined,
      )
      await populateDrains()
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setInviteError('')
    try {
      await inviteToDrain(drainId, email)
      setMembers((prev) => [...prev, email])
      setInviteEmail('')
    } catch (err: any) {
      setInviteError(err?.message ?? 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (email: string) => {
    setMembers((prev) => prev.filter((m) => m !== email))
    try {
      await removeDrainMemberApi(drainId, email)
    } catch {
      // Refresh from server if the optimistic removal turned out to be wrong
      listDrainMembers(drainId).then(setMembers).catch(() => {})
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit drain</DialogTitle>
          <DialogDescription>Update the details for this drain.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="edit-title">Title</Label>
          <Input
            id="edit-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            id="edit-desc"
            placeholder="What's this drain for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-tags">Tags <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex flex-wrap gap-1.5 rounded-md border border-input p-2 min-h-[42px]">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="edit-tags"
              className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
              placeholder={tags.length ? '' : ' Add a tag, press Enter'}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag(tagInput)
                } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                  removeTag(tags[tags.length - 1])
                }
              }}
              onBlur={() => tagInput && addTag(tagInput)}
            />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {visibility === 'shared' && (
          <div className="grid gap-2 border-t pt-3">
            <Label>People with access</Label>
            <div className="flex flex-col gap-1.5">
              {members.map((email) => (
                <div key={email} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                  <span>{email}</span>
                  {isOwner && email !== $identity.get()?.email && (
                    <button
                      type="button"
                      onClick={() => handleRemove(email)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isOwner && (
              <div className="flex gap-1.5">
                <Input
                  placeholder="Invite by email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInvite())}
                />
                <Button type="button" variant="outline" onClick={handleInvite} disabled={inviting}>
                  {inviting ? 'Inviting…' : 'Invite'}
                </Button>
              </div>
            )}
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
