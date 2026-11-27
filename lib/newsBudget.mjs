// Deterministic round-robin allocation of already-normalized, newest-first source batches.
// Keeps the existing public schema limit and never changes a record or its retrieval clock.
export function allocateNewsBatches(batches, limit) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('Invalid news record budget');
  const counts = batches.map(() => 0);
  const records = [];
  for (let round = 0; records.length < limit; round++) {
    let added = false;
    for (let index = 0; index < batches.length && records.length < limit; index++) {
      if (round >= batches[index].length) continue;
      records.push(batches[index][round]);
      counts[index]++;
      added = true;
    }
    if (!added) break;
  }
  return {records, counts};
}
