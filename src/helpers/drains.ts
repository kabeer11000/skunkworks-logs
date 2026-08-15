import { atom } from 'nanostores'
import { ulid } from 'ulid'
import { getDrainDb } from '@/services/db'
import { startDrainSync } from '@/services/sync'
import { createEntry, type EntryIdentity } from '@/services/entries'
import { fetchDrains, createDrain, deleteDrainApi, updateDrainApi } from '@/services/drainsApi'

export const $drains = atom<any[]>([])

// Real-time cross-device updates to the drain list aren't wired up (the
// list now comes from the server-side directory, not a synced database —
// see services/drainsApi.ts) — a plain refetch on mount is good enough for
// now; the drain grid isn't something that needs to update live in the
// background the way an open feed does.
export const populateDrains = async () => {
    const drains = await fetchDrains()
    $drains.set(drains)
}

export async function deleteDrain(dbName: string) {
    await deleteDrainApi(dbName)
    $drains.set($drains.get().filter((d: any) => d.dbName !== dbName))
}

export async function updateDrainMeta(dbName: string, title: string, description?: string, tags?: string[]) {
    await updateDrainApi(dbName, { title, description, tags })
    $drains.set($drains.get().map((d: any) => (d.dbName === dbName ? { ...d, title, description, tags } : d)))
}

const GETTING_STARTED_LINES = [
    '<p>Welcome to Drains — this is your own private drain, just for you.</p>',
    '<p>Click anywhere below and start typing. Every line is its own entry and <strong>autosaves</strong> as you go — no save button.</p>',
    '<p>Select some text and a "Comment" button will appear — leave a note on it, like Google Docs.</p>',
    '<p>Right-click a drain in the sidebar (or use the <strong>…</strong> button) to rename it, copy its link, or delete it.</p>',
    '<p>This drain is private: only you can read or write it. Invite people to a drain from the sidebar to collaborate with them.</p>',
]

// Called once at signup (see Onboarding.tsx) so a brand-new account isn't
// just an empty sidebar.
export async function createGettingStartedDrain(identity: EntryIdentity) {
    const { dbName } = await createDrain('Getting started', 'private')

    const localDb = getDrainDb(dbName)
    for (const html of GETTING_STARTED_LINES) {
        await createEntry(localDb, html, identity, ulid())
    }
    startDrainSync(dbName)

    return dbName
}
