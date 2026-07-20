import { REACTION_TYPES, type ReactionType } from "@/lib/reactions";

export function engagementScore(counts: Record<ReactionType, number>, commentCount: number) {
  const reactions = REACTION_TYPES.reduce((sum, type) => sum + counts[type], 0);
  return reactions + commentCount;
}

// Ratio-relative-to-max means one standout photo pops even in a mostly-zero-
// engagement gallery (the common case early on) without needing a stats
// library. Deliberately continuous (not bucketed into tiers) — feeds
// directly into the mosaic layouts' own size formulas, which each carry
// their own floor so maxScore === 0 doesn't collapse everything to minimum
// size (see lib/mosaic-layout.ts).
export function normalizedEngagement(score: number, maxScore: number) {
  return maxScore > 0 ? score / maxScore : 0;
}
