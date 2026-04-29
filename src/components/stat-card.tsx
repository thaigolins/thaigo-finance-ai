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
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
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
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-card transition-all duration-300 hover:border-border/70">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <div className={cn("opacity-60", accentMap[accent])}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
      <p className="num mt-5 text-[26px] font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "num inline-flex items-center gap-0.5 font-medium",
              trendUp ? "text-success" : "text-destructive",
            )}
          >
            {trendUp ? <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={2.25} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
