import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";

type BadgeVariant =
  | "accent"
  | "healthy"
  | "muted"
  | "outdated"
  | "repair-needed"
  | "stale"
  | "unknown"
  | "update-blocked";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, string> = {
  accent: "border-accent/50 bg-accent/10 text-accent",
  healthy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  muted: "border-border bg-muted text-muted-foreground",
  outdated: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "repair-needed": "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  stale: "border-accent/50 bg-accent/10 text-accent",
  unknown: "border-border bg-muted text-muted-foreground",
  "update-blocked": "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function Badge({ children, className, variant = "muted", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap border px-2 py-0.5 font-mono text-xs",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export { Badge };

export type { BadgeVariant };
