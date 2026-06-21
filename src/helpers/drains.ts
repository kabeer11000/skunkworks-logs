import { atom } from 'nanostores';
import { db } from '@/services/db';
import { getVaultKey } from '@/services/vault';

export const $drains = atom<any[]>([]); // Initialize as an empty array instead of null

// 1. Extract the formatting logic so we can reuse it for both initial load and live updates
const formatDrain = async (nb: any) => {
    const isPrivate = nb.visibility === 'private';
    const hasKey = isPrivate && !!getVaultKey(nb._id);

    let title = nb.title;
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
        unlocked: !isPrivate || hasKey, 
        content: nb.content // <--- ADD THIS!
    };
};

export const populateDrains = async () => {
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
    db.changes({
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
        console.log("updated drainlist")
    }).on('error', (err) => {
        console.error('PouchDB Changes Error:', err);
    });
};