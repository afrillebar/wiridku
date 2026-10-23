export type ReaderScroll = { y: number; direction: -1 | 0 | 1; distance: number; hidden: boolean };

export function readerScrollStart(y: number): ReaderScroll {
  return { y: Math.max(0, y), direction: 0, distance: 0, hidden: false };
}

// Separate thresholds prevent small finger movements from flickering the controls.
export function nextReaderScroll(previous: ReaderScroll, position: number, maxPosition = Infinity): ReaderScroll {
  const y = Math.max(0, Math.min(position, maxPosition));
  if (y <= 48) return readerScrollStart(y);
  const delta = y - previous.y;
  if (Math.abs(delta) < 2) return previous;
  const direction = delta > 0 ? 1 : -1;
  const distance = previous.direction === direction ? previous.distance + Math.abs(delta) : Math.abs(delta);
  const hidden = direction === -1 && distance >= 10 ? false : direction === 1 && y > 140 && distance >= 28 ? true : previous.hidden;
  return { y, direction, distance, hidden };
}
