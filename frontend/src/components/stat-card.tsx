import { cn } from '@/lib/utils';

export function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span
        className={cn(
          'text-xl font-semibold tabular-nums tracking-tight',
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
