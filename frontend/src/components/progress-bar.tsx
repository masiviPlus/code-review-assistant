import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  trackClass = 'bg-secondary',
  fillClass = 'bg-primary',
  className,
}: {
  value: number;
  trackClass?: string;
  fillClass?: string;
  className?: string;
}) {
  return (
    <div className={cn('h-1 w-full rounded-full', trackClass, className)}>
      <div
        className={cn('h-full rounded-full transition-all', fillClass)}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}
