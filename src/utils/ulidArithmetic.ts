// Crockford base32, same alphabet ulid() itself uses.
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Treats a ulid as a big base-32 number and subtracts `by` (with borrow) —
// used when a new block needs to sort immediately BEFORE an existing id
// under descending/newest-first order (see AssignBlockId.ts for the
// split-entry case this was built for).
export function idBefore(id: string, by: number): string {
  const chars = id.split('')
  let remaining = by
  for (let i = chars.length - 1; i >= 0 && remaining > 0; i--) {
    const idx = ULID_ALPHABET.indexOf(chars[i])
    const digitBorrow = remaining % 32
    let carryToNext = Math.floor(remaining / 32)
    let newIdx = idx - digitBorrow
    if (newIdx < 0) {
      newIdx += 32
      carryToNext += 1
    }
    chars[i] = ULID_ALPHABET[newIdx]
    remaining = carryToNext
  }
  return chars.join('')
}

// Sorts strictly between `predecessor` and `id` (predecessor < result < id)
// by appending an extra character to `predecessor` rather than decrementing
// from `id` — decrementing can land EXACTLY on predecessor's own value (or
// even overshoot past it) when the two are numerically adjacent, which this
// app's monotonicFactory ulid generator produces routinely for anything
// minted in the same millisecond (quick typing, pasted multi-line content).
// Appending always sorts strictly after the string appended to, so
// `predecessor + suffix` is guaranteed > predecessor; it sorts < id as long
// as predecessor < id already held (a shared prefix with a lower next
// character, or a shorter string, both compare as expected). `bump`
// distinguishes multiple simultaneous duplicates of the same original id —
// each gets a different suffix off the SAME predecessor (not chained off
// each other's result, which would flip the direction). Falls back to
// idBefore when there's no predecessor to extend (id is already the
// smallest known id).
export function idBetween(predecessor: string | null, id: string, bump: number): string {
  if (predecessor === null) return idBefore(id, bump)
  const suffixIdx = Math.max(0, 31 - bump)
  return predecessor + ULID_ALPHABET[suffixIdx]
}

// Inverse of idBefore — adds `by` (with carry) instead of subtracting, for
// a new block that needs to sort immediately AFTER an existing id (a day's
// AI summary sorting directly above that day's newest entry, under
// newest-first/descending order — see couchdb-admin.ts's createSummaryEntry).
export function idAfter(id: string, by: number): string {
  const chars = id.split('')
  let remaining = by
  for (let i = chars.length - 1; i >= 0 && remaining > 0; i--) {
    const idx = ULID_ALPHABET.indexOf(chars[i])
    const digitCarry = remaining % 32
    let carryToNext = Math.floor(remaining / 32)
    let newIdx = idx + digitCarry
    if (newIdx > 31) {
      newIdx -= 32
      carryToNext += 1
    }
    chars[i] = ULID_ALPHABET[newIdx]
    remaining = carryToNext
  }
  return chars.join('')
}
