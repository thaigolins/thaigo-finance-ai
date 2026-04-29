import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "muted";
}

const accentMap = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
  muted: "text-muted-foreground bg-muted/40",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = "primary",
}: StatCardProps) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-card transition-all hover:border-primary/30 hover:shadow-elegant">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
              trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-opacity group-hover:bg-primary/10" />
    </div>
  );
}
