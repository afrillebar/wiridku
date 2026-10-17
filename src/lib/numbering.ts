type NumberedRecitation = { show_number: boolean };
type NumberedPhase<R extends NumberedRecitation> = { continue_numbering: boolean; recitations: R[] };

// Pure on purpose: the public page, the preview, and the admin lists all share it, and the lists run it again on optimistic state.
// `counts` decides which recitations take a number (e.g. published and active); the rest get null.
export function assignNumbers<R extends NumberedRecitation, P extends NumberedPhase<R>>(
  phases: P[],
  counts: (r: R, p: P) => boolean = () => true,
): Map<R, number | null> {
  const out = new Map<R, number | null>();
  let n = 0;
  phases.forEach((p, i) => {
    if (i === 0 || !p.continue_numbering) n = 0;
    for (const r of p.recitations) out.set(r, r.show_number && counts(r, p) ? ++n : null);
  });
  return out;
}
