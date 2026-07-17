import { cn } from "@/lib/utils";
import { rankTextClass } from "@/lib/rank";

export function RankName({
  profile,
  className,
}: {
  profile: {
    display_name: string | null;
    email: string | null;
    role: string | null;
  };
  className?: string;
}) {
  return (
    <span className={cn(rankTextClass(profile.role), className)}>
      {profile.display_name ?? profile.email ?? "Unknown"}
    </span>
  );
}
