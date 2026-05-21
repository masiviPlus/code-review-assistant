import { Types } from 'mongoose';

// ── Strategy pattern ────────────────────────────────────────
//
// Each achievement is implemented as an AchievementChecker — a
// concrete strategy that encapsulates one unlock criterion.
// The engine iterates over all registered checkers after every
// submission, keeping the orchestrator (index.ts) closed for
// modification but open for extension.

/** Pre-fetched data shared across all checkers to avoid redundant queries. */
export interface CheckerContext {
  userId: Types.ObjectId;
  submission: {
    _id: Types.ObjectId;
    code: string;
    language: string;
    scoreOverall: number;
    scoreBreakdown: {
      style: number;
      bestPractices: number;
      logic: number;
      readability: number;
    };
  };
  /** Total completed (non-deleted) submissions for this user, including the latest. */
  totalSubmissions: number;
  /** Current streak in calendar days (from the points engine). */
  streak: number;
  /** Number of error-level issues on the latest submission. */
  errorIssueCount: number;
}

/** Progress toward an achievement: current value vs. target. */
export interface AchievementProgress {
  current: number;
  target: number;
}

/**
 * Strategy interface — each achievement implements this contract.
 *
 * - `code` must match the seeded Achievement.code in the database.
 * - `check` returns true when the achievement should be awarded.
 * - `progress` returns how far along the user is (for the GET endpoint).
 */
export interface AchievementChecker {
  /** Matches Achievement.code in Mongo (e.g. 'first_steps'). */
  code: string;

  /** Returns true if the achievement criteria are met. */
  check(ctx: CheckerContext): Promise<boolean>;

  /** Returns current / target progress for display in the UI. */
  progress(ctx: CheckerContext): Promise<AchievementProgress>;
}
