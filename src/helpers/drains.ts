import { atom } from 'nanostores';
import { db } from '@/services/db';
import { getVaultKey } from '@/services/vault';

export const $drains = atom<any>(null);
export const populateDrains = async () => {
    const result = await db.allDocs({
        startkey: 'notebook:',
        endkey: 'notebook:\uffff',
        include_docs: true
    });
    // @ts-ignore
    $drains.set(await Promise.all(result.rows.map(async (row: { doc: any; }) => {
        const nb = row.doc;
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
            unlocked: !isPrivate || hasKey
        };
    })));

}
