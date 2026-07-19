import { REACTION_TYPES, type ReactionType } from "@/lib/reactions";

export type EngagementTier = "hero" | "large" | "medium" | "small";

export function engagementScore(counts: Record<ReactionType, number>, commentCount: number) {
  const reactions = REACTION_TYPES.reduce((sum, type) => sum + counts[type], 0);
  return reactions + commentCount;
}

// Ratio-relative-to-max means one standout photo pops even in a mostly-zero-
// engagement gallery (the common case early on) without needing a stats
// library. maxScore === 0 (nobody's reacted to anything yet) falls back to a
// uniform "medium" so the wall doesn't look broken before it has any data.
export function tierFor(score: number, maxScore: number): EngagementTier {
  if (maxScore === 0) return "medium";
  const ratio = score / maxScore;
  if (ratio >= 0.75) return "hero";
  if (ratio >= 0.4) return "large";
  if (ratio >= 0.15) return "medium";
  return "small";
}
