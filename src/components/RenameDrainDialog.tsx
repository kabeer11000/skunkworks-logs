import { useState } from 'react'
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

interface EditDrainDialogProps {
  drainId: string
  currentTitle: string
  currentDescription?: string
  currentTags?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RenameDrainDialog({
  drainId,
  currentTitle,
  currentDescription = '',
  currentTags = [],
  open,
  onOpenChange,
}: EditDrainDialogProps) {
  const [title, setTitle] = useState(currentTitle)
  const [description, setDescription] = useState(currentDescription)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(currentTags)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle(currentTitle)
      setDescription(currentDescription)
      setTags(currentTags)
      setTagInput('')
      setError('')
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
