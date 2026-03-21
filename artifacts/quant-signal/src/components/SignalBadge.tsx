import { cn } from "@/lib/utils";

export type SignalType = "Buy" | "Sell" | "Hold" | "Avoid";

interface SignalBadgeProps {
  signal: SignalType | string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SignalBadge({ signal, className, size = "md" }: SignalBadgeProps) {
  const getStyles = () => {
    switch (signal) {
      case "Buy":
        return "bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(var(--primary),0.2)]";
      case "Sell":
        return "bg-destructive/20 text-destructive border-destructive/50 shadow-[0_0_10px_rgba(var(--destructive),0.2)]";
      case "Hold":
        return "bg-chart-2/20 text-chart-2 border-chart-2/50 shadow-[0_0_10px_rgba(var(--chart-2),0.2)]";
      case "Avoid":
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getSize = () => {
    switch (size) {
      case "sm": return "px-2 py-0.5 text-xs";
      case "lg": return "px-6 py-2 text-lg uppercase tracking-wider";
      case "md":
      default: return "px-3 py-1 text-sm font-semibold uppercase tracking-wider";
    }
  };

  return (
    <span className={cn("inline-flex items-center justify-center rounded-full border font-bold", getStyles(), getSize(), className)}>
      {signal}
    </span>
  );
}
