// Two packing algorithms for laying real photos out as a tight, continuous
// mosaic instead of a cropped, tiered grid. Chosen per context, not
// one-size-fits-all:
//
//   layoutJustifiedRows -- the Flickr/Google Photos algorithm. Packs items
//   left-to-right at a shared row height, then rescales each completed row
//   so it fills the container width exactly. DOM order stays visual order,
//   which is why this is used for photo clusters inline in the Feed's
//   chronological stream.
//
//   layoutSkyline -- a real 2D shelf-packer. Tracks a discretized "skyline"
//   of column heights across the width and drops each item into the
//   lowest/flattest spot wide enough for it. Genuinely irregular in both
//   size and position, at the cost of DOM order no longer matching visual
//   order -- used for the whole Moments gallery, which has no such ordering
//   constraint.
//
// Both take a continuous `engagement` in roughly [0,1] (see
// lib/engagement.ts's normalizedEngagement) rather than a bucketed tier, and
// both formulas carry a floor so an all-zero-engagement set (a young
// gallery with no reactions yet) doesn't collapse everything to minimum size.

export type MosaicItem = { id: string; aspect: number; engagement: number };
export type PositionedItem = MosaicItem & { x: number; y: number; w: number; h: number };

const ASPECT_MIN = 0.5;
const ASPECT_MAX = 2;
const MAX_ROW_STRETCH = 1.7;

function clampAspect(aspect: number) {
  return Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, aspect));
}

// Photos uploaded before width/height were captured have neither -- fall
// back to a square aspect ratio rather than special-casing null everywhere
// the mosaic layouts are called.
export function photoAspect(width: number | null, height: number | null) {
  return width && height ? width / height : 1;
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function layoutJustifiedRows(
  items: MosaicItem[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number,
): { positions: PositionedItem[]; height: number } {
  const positions: PositionedItem[] = [];
  let row: { item: MosaicItem; effAspect: number }[] = [];
  let aspectSum = 0;
  let y = 0;

  function flush() {
    if (row.length === 0) return;
    // Cap how far a row can stretch to fill the width. Without this, a
    // small leftover group (the common case for the Feed's photo clusters,
    // which rarely run long enough to overflow a row on their own) could
    // blow a single narrow portrait photo up to a grotesque height trying
    // to fill the container width alone. Capped rows simply don't fill the
    // last bit of width rather than distorting the photo's proportions
    // that far.
    const naturalH = (containerWidth - (row.length - 1) * gap) / aspectSum;
    const h = Math.min(naturalH, targetRowHeight * MAX_ROW_STRETCH);
    let x = 0;
    for (const entry of row) {
      const w = entry.effAspect * h;
      positions.push({ ...entry.item, x, y, w, h });
      x += w + gap;
    }
    y += h + gap;
  }

  for (const item of items) {
    const aspect = clampAspect(item.aspect);
    const effAspect = aspect * (0.6 + 1.6 * item.engagement);
    row.push({ item, effAspect });
    aspectSum += effAspect;
    const widthAtTarget = aspectSum * targetRowHeight + (row.length - 1) * gap;
    if (widthAtTarget >= containerWidth) {
      flush();
      row = [];
      aspectSum = 0;
    }
  }
  // Every row, including a trailing incomplete one, always stretches to
  // fill the width (capped, see flush()) -- Moments doesn't use this
  // algorithm at all (it uses layoutSkyline), and the Feed's groups are
  // small photo clusters, not one continuous gallery, so there's no "huge
  // final remainder" case to protect against the way a classic photo-grid
  // justified layout would need to.
  flush();

  return { positions, height: Math.max(0, y - gap) };
}

export function layoutSkyline(
  items: MosaicItem[],
  containerWidth: number,
  gap: number,
  baseArea: number,
): { positions: PositionedItem[]; height: number } {
  const SLOTS = 64;
  const slotWidth = containerWidth / SLOTS;
  const heights = new Array(SLOTS).fill(0);
  const positions: PositionedItem[] = [];

  for (const item of items) {
    const aspect = clampAspect(item.aspect);
    const jitter = 1 + ((hashCode(item.id) % 17) - 8) / 100;
    const targetArea = baseArea * (0.42 + 2.6 * item.engagement) * jitter;

    // Decide width first (via the jittered area target), then derive height
    // from the photo's real (clamped) aspect ratio -- never derive width and
    // height independently from the area, or the box stops matching the
    // photo's proportions and object-cover's crop stops being negligible.
    let h = Math.sqrt(targetArea / aspect);
    let w = h * aspect;
    const slots = Math.max(2, Math.min(SLOTS, Math.round(w / slotWidth)));
    w = slots * slotWidth;
    h = w / aspect;

    let bestStart = 0;
    let bestY = Infinity;
    for (let s = 0; s <= SLOTS - slots; s++) {
      let maxY = 0;
      for (let k = s; k < s + slots; k++) {
        if (heights[k] > maxY) maxY = heights[k];
      }
      if (maxY < bestY) {
        bestY = maxY;
        bestStart = s;
      }
    }

    const x = bestStart * slotWidth;
    positions.push({ ...item, x, y: bestY, w, h });
    for (let k = bestStart; k < bestStart + slots; k++) {
      heights[k] = bestY + h + gap;
    }
  }

  return { positions, height: Math.max(0, Math.max(0, ...heights) - gap) };
}
