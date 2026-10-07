/** Clamps a left-pane ratio so both panes keep at least their minimum width (px). */
export function clampSplit(ratio: number, totalWidth: number, minLeft: number, minRight: number): number {
  if (!Number.isFinite(ratio)) ratio = 0.5
  if (totalWidth <= minLeft + minRight) return minLeft / (minLeft + minRight)
  const lo = minLeft / totalWidth
  const hi = 1 - minRight / totalWidth
  return Math.min(hi, Math.max(lo, ratio))
}

/** Largest scale at which a w×h box fits inside the available area, minus padding on each side. */
export function fitScale(availW: number, availH: number, w: number, h: number, padding = 0): number {
  const sw = (availW - padding * 2) / w
  const sh = (availH - padding * 2) / h
  return Math.max(0, Math.min(sw, sh))
}
