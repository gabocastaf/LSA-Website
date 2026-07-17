export type Role = "pledge" | "active" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  pledge: "Pledge",
  active: "Active",
  admin: "Admin",
};

export const ROLE_RANK: Record<Role, number> = {
  pledge: 0,
  active: 1,
  admin: 2,
};

function isRole(value: string | null | undefined): value is Role {
  return value === "pledge" || value === "active" || value === "admin";
}

export function roleRank(role: string | null | undefined): number {
  return isRole(role) ? ROLE_RANK[role] : ROLE_RANK.pledge;
}

export function rankBadgeClass(role: string | null | undefined): string {
  if (role === "admin") return "bg-foreground text-background";
  if (role === "active") return "bg-secondary text-secondary-foreground";
  return "bg-muted text-muted-foreground";
}

export function rankTextClass(role: string | null | undefined): string {
  if (role === "admin") return "font-semibold text-amber-600 dark:text-amber-400";
  if (role === "active") return "font-medium text-blue-600 dark:text-blue-400";
  return "text-muted-foreground";
}
