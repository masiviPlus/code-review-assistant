import type { Submission } from './types';

/** Average overall score of the most recent 10 completed submissions. */
export function computeAvgScore(submissions: Submission[]): number | null {
  const scored = submissions
    .filter((s) => s.status === 'complete' && s.scoreOverall != null)
    .slice(0, 10);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, s) => acc + s.scoreOverall!, 0);
  return Math.round(sum / scored.length);
}

/** Consecutive calendar days with at least one submission, counting back from today. */
export function computeStreak(submissions: Submission[]): number {
  if (submissions.length === 0) return 0;

  const days = new Set(
    submissions.map((s) => {
      const d = new Date(s.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );

  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

/** Returns the lowest-scoring category if it's below 80, or null. */
export function topIssueCategory(submission: Submission): string | null {
  if (!submission.scoreBreakdown) return null;
  const { style, bestPractices, logic, readability } = submission.scoreBreakdown;
  const cats: [string, number][] = [
    ['Style', style],
    ['Best practices', bestPractices],
    ['Logic', logic],
    ['Readability', readability],
  ];
  cats.sort((a, b) => a[1] - b[1]);
  return cats[0][1] < 80 ? cats[0][0] : null;
}

/** Builds Recharts-compatible data from the 20 most recent completed submissions. */
export function buildChartData(submissions: Submission[]) {
  return submissions
    .filter((s) => s.status === 'complete' && s.scoreOverall != null)
    .slice(0, 20)
    .reverse()
    .map((s, i) => ({
      index: i,
      score: s.scoreOverall!,
      label: new Date(s.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }));
}
