import { useEffect, useMemo, useState } from 'react'
import { atom } from 'nanostores'
import { useStore } from '@nanostores/react'
import { $drains } from '@/helpers/drains'
import { getDrainDb } from '@/services/db'
import { stripHtml } from '@/utils/stripHtml'
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

interface EntryResult {
  dbName: string
  drainTitle: string
  entryId: string
  snippet: string
}

// Shared so a sidebar search button (AppSidebar.tsx) can open the palette
// too, not just the Cmd+K shortcut.
export const $commandPaletteOpen = atom(false)

// Only searches entries already synced into each drain's local PouchDB —
// consistent with the app's local-first positioning, but means a drain
// never opened on this device won't have anything to search yet.
export function CommandPalette() {
  const drains = useStore($drains)
  const open = useStore($commandPaletteOpen)
  const setOpen = (next: boolean) => $commandPaletteOpen.set(next)
  const [query, setQuery] = useState('')
  const [entryResults, setEntryResults] = useState<EntryResult[]>([])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        $commandPaletteOpen.set(!$commandPaletteOpen.get())
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setEntryResults([])
      return
    }
    let cancelled = false
    const q = query.trim().toLowerCase()

    Promise.all(
      drains.map(async (drain: any) => {
        const db = getDrainDb(drain.dbName)
        const res = await db
          .allDocs({ startkey: 'entry:', endkey: 'entry:￿', include_docs: true })
          .catch(() => ({ rows: [] as any[] }))
        return res.rows
          .map((r: any) => r.doc)
          .filter(Boolean)
          .map((doc: any) => ({ doc, text: stripHtml(doc.content) }))
          .filter(({ text }: any) => text.toLowerCase().includes(q))
          .slice(0, 5)
          .map(
            ({ doc, text }: any): EntryResult => ({
              dbName: drain.dbName,
              drainTitle: drain.title || 'Untitled',
              entryId: doc._id.slice('entry:'.length),
              snippet: text.slice(0, 120),
            })
          )
      })
    ).then((groups) => {
      if (!cancelled) setEntryResults(groups.flat())
    })

    return () => {
      cancelled = true
    }
  }, [open, query, drains])

  const drainMatches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return drains.filter((d: any) => (d.title || '').toLowerCase().includes(q))
  }, [query, drains])

  const goToDrain = (dbName: string) => {
    setOpen(false)
    window.location.href = `/drains/${dbName}`
  }

  const goToEntry = (dbName: string, entryId: string) => {
    setOpen(false)
    window.location.href = `/drains/${dbName}#entry-${entryId}`
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search drains and entries"
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search drains and entries…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[26rem]">
          <CommandEmpty>No results.</CommandEmpty>
          {drainMatches.length > 0 && (
            <CommandGroup heading="Drains">
              {drainMatches.map((d: any) => (
                <CommandItem key={d.dbName} value={d.dbName} onSelect={() => goToDrain(d.dbName)}>
                  {d.title || 'Untitled'}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {entryResults.length > 0 && (
            <CommandGroup heading="Entries">
              {entryResults.map((r) => (
                <CommandItem
                  key={`${r.dbName}-${r.entryId}`}
                  value={`${r.dbName}-${r.entryId}`}
                  onSelect={() => goToEntry(r.dbName, r.entryId)}
                >
                  <span className="flex flex-col">
                    <span className="text-xs text-muted-foreground">{r.drainTitle}</span>
                    <span className="line-clamp-1">{r.snippet}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
