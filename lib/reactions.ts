export const REACTION_TYPES = ["fire", "heart", "laugh", "skull"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  fire: { emoji: "🔥", label: "Certified banger" },
  heart: { emoji: "❤️", label: "Wholesome despite everything" },
  laugh: { emoji: "😂", label: "Deeply unserious" },
  skull: { emoji: "💀", label: "This should be deleted" },
};
