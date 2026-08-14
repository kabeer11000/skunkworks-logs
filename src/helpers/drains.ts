import { atom } from 'nanostores';
import { ulid } from 'ulid';
import { db } from '@/services/db';
import { getVaultKey, setVaultKey } from '@/services/vault';
import { createEntry, type EntryIdentity } from '@/services/entries';

export const $drains = atom<any[]>([]); // Initialize as an empty array instead of null

// 1. Extract the formatting logic so we can reuse it for both initial load and live updates
const formatDrain = async (nb: any) => {
    const isPrivate = nb.visibility === 'private';
    const hasKey = isPrivate && !!getVaultKey(nb._id);

    let title = nb.title;
    // Private drain with a key but no plain title stored — decrypt from cipher
    if (isPrivate && hasKey && !title && nb.titleCipher) {
        try {
            const { importNotebookKey, decryptString } = await import('@/services/crypto.js');
            const cryptoKey = await importNotebookKey(getVaultKey(nb._id));
            title = await decryptString(cryptoKey, nb.titleCipher);
        } catch {
            title = null;
        }
    }
    // Private drain with cipher but no key yet — hide title until key is available
    if (isPrivate && !hasKey && nb.titleCipher) {
        title = null;
    }

    return {
        id: nb._id,
        _id: nb._id,
        _rev: nb._rev,
        visibility: nb.visibility,
        title,
        titleCipher: nb.titleCipher,
        description: nb.description,
        tags: nb.tags,
        unlocked: !isPrivate || hasKey,
    };
};

// AppSidebar's effect calls this on every mount, and React may remount it
// across navigations, so populateDrains() must be safe to call more than
// once \u2014 otherwise every remount leaks another live db.changes() listener,
// and N leaked listeners means one real change gets applied N times.
let activeChanges: ReturnType<typeof db.changes> | null = null;

export const populateDrains = async () => {
    activeChanges?.cancel();

    // 2. Perform the initial static fetch for fast loading
    const result = await db.allDocs({
        startkey: 'notebook:',
        endkey: 'notebook:\uffff',
        include_docs: true
    });

    const initialDrains = await Promise.all(
        result.rows.map(row => formatDrain(row.doc))
    );

    $drains.set(initialDrains);

    // 3. Set up the live listener for any future changes
    activeChanges = db.changes({
        since: 'now', // Only listen to things that happen AFTER the initial fetch
        live: true,   // Keep the connection open permanently
        include_docs: true
    }).on('change', async (change) => {
        // Ignore changes to documents that aren't notebooks
        if (!change.id.startsWith('notebook:')) return;

        const currentDrains = $drains.get();

        // Handle Deletions
        if (change.deleted) {
            $drains.set(currentDrains.filter((d: any) => d._id !== change.id));
            return;
        }

        // Handle Updates and Creations
        const updatedDrain = await formatDrain(change.doc);
        const existingIndex = currentDrains.findIndex((d: any) => d._id === change.id);

        if (existingIndex > -1) {
            // Update existing notebook
            const newDrains = [...currentDrains];
            newDrains[existingIndex] = updatedDrain;
            $drains.set(newDrains);
        } else {
            // Add brand new notebook
            $drains.set([...currentDrains, updatedDrain]);
        }
    }).on('error', (err) => {
        console.error('PouchDB Changes Error:', err);
    });
};

export async function deleteDrain(id: string) {
    const doc = await db.get(id);
    await db.remove(doc);
    $drains.set($drains.get().filter((d: any) => d._id !== id));
}

export async function updateDrainMeta(id: string, title: string, description?: string, tags?: string[]) {
    const doc: any = await db.get(id);
    if (title !== undefined) {
        if (doc.visibility === 'private') {
            const key = getVaultKey(doc._id);
            if (!key) throw new Error('No encryption key for this private drain');
            const { importNotebookKey, encryptString } = await import('@/services/crypto.js');
            const cryptoKey = await importNotebookKey(key);
            doc.titleCipher = await encryptString(cryptoKey, title);
            doc.title = null;
        } else {
            doc.title = title;
        }
    }
    if (description !== undefined) doc.description = description;
    if (tags !== undefined) doc.tags = tags;
    await db.put(doc);
}

const GETTING_STARTED_LINES = [
    '<p>Welcome to SkunkWorks Logs — this is your own private drain, just for you.</p>',
    '<p>Click anywhere below and start typing. Every line is its own entry and <strong>autosaves</strong> as you go — no save button.</p>',
    '<p>Select some text and a "Comment" button will appear — leave a note on it, like Google Docs.</p>',
    '<p>Right-click a drain in the sidebar (or use the <strong>…</strong> button) to rename it, copy its link, or delete it.</p>',
    '<p>This drain is private: encrypted with a key that only lives on this device. Create a shared drain from the sidebar for anything you want other people to read.</p>',
]

// Called once at signup (see Onboarding.tsx) so a brand-new account isn't
// just an empty sidebar. Silently unrecoverable if local storage is ever
// cleared, same as any other private drain — acceptable here since it's
// throwaway instructional content, not user data, so we skip NewDrainDialog's
// "back up this key" step.
export async function createGettingStartedDrain(identity: EntryIdentity) {
    const id = `notebook:${ulid()}`
    const { generateNotebookKey, importNotebookKey, encryptString } = await import('@/services/crypto.js')
    const key = await generateNotebookKey()
    const cryptoKey = await importNotebookKey(key)
    const titleCipher = await encryptString(cryptoKey, 'Getting started')

    await db.put({
        _id: id,
        type: 'notebook',
        visibility: 'private',
        title: null,
        titleCipher,
        createdBy: identity.publicUserId,
        createdAt: Date.now(),
    })
    setVaultKey(id, key)

    for (const html of GETTING_STARTED_LINES) {
        await createEntry(id, html, identity, ulid())
    }

    return id
}