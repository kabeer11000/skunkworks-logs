import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ulid } from 'ulid'
import { db } from '@/services/db'
import { setVaultKey } from '@/services/vault'
import { $identity } from '@/services/identity'

type Visibility = 'shared' | 'private'

export default function NewDrainDialog() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('shared')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setDescription('')
    setTagInput('')
    setTags([])
    setVisibility('shared')
    setGeneratedKey(null)
  }

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t))

  const create = async () => {
    const finalTitle = title.trim() || 'Untitled'
    const id = `notebook:${ulid()}`
    let titleCipher = null
    let plainTitle: string | null = finalTitle
    let key: string | null = null

    if (visibility === 'private') {
      const { generateNotebookKey, importNotebookKey, encryptString } = await import('@/services/crypto.js')
      key = await generateNotebookKey()
      const cryptoKey = await importNotebookKey(key)
      titleCipher = await encryptString(cryptoKey, finalTitle)
      // titleCipher = encrypted copy for sharing; plainTitle kept in memory for local display
      setVaultKey(id, key)
    }

    const identity = $identity.get()
    await db.put({
      _id: id,
      type: 'notebook',
      visibility,
      title: plainTitle,
      description: description.trim() || undefined,
      tags: tags.length ? tags : undefined,
      titleCipher,
      createdBy: identity?.publicUserId,
      createdAt: Date.now(),
    })

    if (key) {
      setGeneratedKey(key)
    } else {
      setOpen(false)
      reset()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger render={<Button size="sm" className="rounded-full" />}>New drain</DialogTrigger>
      <DialogContent>
        {generatedKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Save your private key</DialogTitle>
              <DialogDescription>
                Copy this key and store it safely. You will need it to access this drain on other
                devices. It cannot be recovered.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedKey)}
              className="rounded-md border bg-muted px-3 py-2 text-left font-mono text-xs break-all"
              title="Click to copy"
            >
              {generatedKey}
            </button>
            <p className="text-xs text-destructive">
              This key will never be shown again. If you lose it, your drain data is permanently
              inaccessible.
            </p>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New drain</DialogTitle>
              <DialogDescription>Create a new drain for your changelog entries.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="drain-title">Title</Label>
              <Input
                id="drain-title"
                placeholder="Release notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drain-desc">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="drain-desc"
                placeholder="What's this drain for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="drain-tags">Tags <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                  id="drain-tags"
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
            <div className="grid gap-2">
              <Label>Visibility</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('shared')}
                  className={`flex-1 rounded-md border p-3 text-left text-sm ${visibility === 'shared' ? 'border-primary bg-accent' : ''}`}
                >
                  <div className="font-semibold">Shared</div>
                  <div className="text-xs text-muted-foreground">Anyone can read &amp; write</div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex-1 rounded-md border p-3 text-left text-sm ${visibility === 'private' ? 'border-primary bg-accent' : ''}`}
                >
                  <div className="font-semibold">Private</div>
                  <div className="text-xs text-muted-foreground">End-to-end encrypted</div>
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={create}>Create</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
