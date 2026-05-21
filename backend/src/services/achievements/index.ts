import { Types } from 'mongoose';
import pino from 'pino';
import { Achievement } from '../../models/Achievement';
import { UserAchievement } from '../../models/UserAchievement';
import { Submission, completedFilter } from '../../models/Submission';
import { Issue } from '../../models/Issue';
import { computeStreak } from '../points';
import { checkers } from './checkers';
import type { CheckerContext, AchievementProgress } from './types';

export type { AchievementChecker, AchievementProgress, CheckerContext } from './types';

const logger = pino({ name: 'achievements' });

// ── Build shared context ────────────────────────────────────
//
// Pre-fetches data that multiple checkers need so we don't hit
// the database once per checker per submission.

async function buildContext(
  userId: Types.ObjectId,
  submission: CheckerContext['submission'],
): Promise<CheckerContext> {
  const [totalSubmissions, streak, errorIssueCount] = await Promise.all([
    Submission.countDocuments(completedFilter(userId)),
    computeStreak(userId),
    Issue.countDocuments({ submissionId: submission._id, severity: 'error' }),
  ]);

  return { userId, submission, totalSubmissions, streak, errorIssueCount };
}

// ── Achievement engine ──────────────────────────────────────
//
// Runs every registered checker against the current context.
// Idempotent: already-unlocked achievements are skipped before
// any checker runs, and the unique compound index on
// UserAchievement(userId, achievementId) guards against races.

export async function evaluateAchievements(
  userId: Types.ObjectId,
  submission: CheckerContext['submission'],
): Promise<void> {
  const ctx = await buildContext(userId, submission);

  // Load achievement definitions and already-unlocked set in parallel
  const [achievementDocs, unlocked] = await Promise.all([
    Achievement.find().lean(),
    UserAchievement.find({ userId }).select('achievementId').lean(),
  ]);

  const unlockedSet = new Set(unlocked.map((ua) => ua.achievementId.toString()));
  const codeToId = new Map(achievementDocs.map((a) => [a.code, a._id]));

  for (const checker of checkers) {
    const achievementId = codeToId.get(checker.code);
    if (!achievementId) continue; // not seeded yet
    if (unlockedSet.has(achievementId.toString())) continue; // already awarded

    try {
      const earned = await checker.check(ctx);
      if (!earned) continue;

      // Insert with upsert to handle any race condition gracefully
      await UserAchievement.updateOne(
        { userId, achievementId },
        { $setOnInsert: { userId, achievementId, unlockedAt: new Date() } },
        { upsert: true },
      );

      logger.info({ userId, achievement: checker.code }, 'Achievement unlocked');
    } catch (err) {
      // A single failing checker must not prevent others from running
      logger.error({ err, achievement: checker.code }, 'Achievement check failed');
    }
  }
}

// ── Progress for GET /api/achievements ──────────────────────

export interface AchievementStatus {
  code: string;
  name: string;
  description: string;
  criteria: string;
  unlocked: boolean;
  unlockedAt: Date | null;
  progress: AchievementProgress;
}

export async function getAchievementsForUser(
  userId: Types.ObjectId,
): Promise<AchievementStatus[]> {
  const [achievementDocs, userAchievements, latestSubmission] = await Promise.all([
    Achievement.find().lean(),
    UserAchievement.find({ userId }).lean(),
    Submission.findOne(completedFilter(userId))
      .sort({ _id: -1 })
      .lean(),
  ]);

  const unlockedMap = new Map(
    userAchievements.map((ua) => [ua.achievementId.toString(), ua.unlockedAt]),
  );

  // Build a lightweight context for progress calculation.
  // If the user has no submissions yet, use zeroed-out defaults.
  const sb = latestSubmission?.scoreBreakdown;
  const dummySubmission: CheckerContext['submission'] = latestSubmission
    ? {
        _id: latestSubmission._id,
        code: latestSubmission.code,
        language: latestSubmission.language,
        scoreOverall: latestSubmission.scoreOverall ?? 0,
        scoreBreakdown: {
          style: sb?.style ?? 0,
          bestPractices: sb?.bestPractices ?? 0,
          logic: sb?.logic ?? 0,
          readability: sb?.readability ?? 0,
        },
      }
    : {
        _id: new Types.ObjectId(),
        code: '',
        language: 'javascript',
        scoreOverall: 0,
        scoreBreakdown: { style: 0, bestPractices: 0, logic: 0, readability: 0 },
      };

  const ctx = await buildContext(userId, dummySubmission);

  const checkerMap = new Map(checkers.map((c) => [c.code, c]));

  const results: AchievementStatus[] = [];

  for (const doc of achievementDocs) {
    const unlocked = unlockedMap.has(doc._id.toString());
    const unlockedAt = unlockedMap.get(doc._id.toString()) ?? null;

    const checker = checkerMap.get(doc.code);
    let progress: AchievementProgress = { current: 0, target: 1 };

    if (checker) {
      try {
        const p = await checker.progress(ctx);
        progress = unlocked ? { current: p.target, target: p.target } : p;
      } catch {
        // Fall back to unknown progress
      }
    }

    results.push({
      code: doc.code,
      name: doc.name ?? '',
      description: doc.description ?? '',
      criteria: doc.criteria ?? '',
      unlocked,
      unlockedAt,
      progress,
    });
  }

  return results;
}
