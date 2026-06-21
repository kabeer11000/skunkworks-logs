import { atom } from 'nanostores';

export const $syncStatus = atom<'active' | 'paused' | 'error' | null>(null);
