/* ------------------------------------------------------------------ */
/*  Score colour helpers used across dashboard and submission pages     */
/* ------------------------------------------------------------------ */

/** Tailwind text colour class based on score threshold. */
export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** Tailwind background colour class for progress bars. */
export function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500 dark:bg-green-400';
  if (score >= 50) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-red-500 dark:bg-red-400';
}

/** Raw HSL fill for Recharts bars/cells. */
export function barFill(score: number): string {
  if (score >= 80) return 'hsl(142, 71%, 45%)';
  if (score >= 50) return 'hsl(38, 92%, 50%)';
  return 'hsl(0, 84%, 60%)';
}
