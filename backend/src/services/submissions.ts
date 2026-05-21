import { Types } from 'mongoose';
import pino from 'pino';
import { Submission, completedFilter } from '../models/Submission';
import { Issue } from '../models/Issue';
import type { LLMClient } from './llm/types';
import { applyScoring } from './scoring';
import { awardSubmissionPoints } from './points';
import { evaluateAchievements } from './achievements';

const logger = pino({ name: 'submission-service' });

const LLM_TIMEOUT_MS = 30_000;

// ── Helpers ─────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LLM call timed out')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── analyseAndScore ─────────────────────────────────────────
//
// Orchestrates the full submission lifecycle:
//   1. Persist submission immediately (code is never lost).
//   2. Call LLM with timeout.
//   3. Apply deterministic scoring adjustments.
//   4. Persist issues.
//   5. Mark submission complete.
//   6. Award points & evaluate achievements (fire-and-forget).
//
// Returns the saved submission + issues on success.
// On LLM failure, marks the submission as 'failed' and throws.

export async function analyseAndScore(
  userId: Types.ObjectId,
  code: string,
  language: string,
  llmClient: LLMClient,
) {
  // Step 1: persist submission
  const submission = await Submission.create({
    userId,
    code,
    language,
    status: 'analysing',
  });

  try {
    // Step 2: call LLM
    const rawResult = await withTimeout(
      llmClient.analyseCode(code, language),
      LLM_TIMEOUT_MS,
    );

    // Step 3: scoring adjustments
    const codeLineCount = code.split('\n').length;
    const result = applyScoring(rawResult, codeLineCount);

    // Step 4: persist issues
    const issues = await Issue.insertMany(
      result.issues.map((issue) => ({
        ...issue,
        submissionId: submission._id,
      })),
    );

    // Step 5: mark complete
    submission.status = 'complete';
    submission.scoreOverall = result.scoreOverall;
    submission.scoreBreakdown = result.scoreBreakdown;
    submission.summary = result.summary;
    await submission.save();

    // Step 6: fire-and-forget side-effects
    awardSubmissionPoints(userId, submission._id, result.scoreOverall)
      .catch((err) => logger.error({ err, submissionId: submission._id }, 'Failed to award points'));

    evaluateAchievements(userId, {
      _id: submission._id,
      code,
      language,
      scoreOverall: result.scoreOverall,
      scoreBreakdown: result.scoreBreakdown,
    }).catch((err) => logger.error({ err, submissionId: submission._id }, 'Failed to evaluate achievements'));

    return { submission, issues };
  } catch (err) {
    // Preserve code, mark as failed
    submission.status = 'failed';
    await submission.save();
    throw err;
  }
}

// ── Message normalisation ───────────────────────────────────
//
// LLM-generated messages have small variations (different variable
// names, line numbers, literals) that prevent grouping. We normalise
// to a stable key for aggregation while preserving the most recent
// original wording for display.

export function normaliseMessage(msg: string): string {
  return msg
    .replace(/['"`].*?['"`]/g, '<name>')  // quoted identifiers
    .replace(/`[^`]*`/g, '<name>')         // backtick identifiers
    .replace(/\b\d+\b/g, '<n>')            // numeric literals
    .replace(/\bline\s+<n>/gi, '')         // "line 42" references
    .replace(/\bcol(?:umn)?\s+<n>/gi, '')  // "column 7" references
    .replace(/\s+/g, ' ')                  // collapse whitespace
    .trim()
    .toLowerCase();
}

// ── getStats ────────────────────────────────────────────────
//
// Aggregated stats for the dashboard: category averages and
// top recurring issues across the user's submission history.

export async function getStats(userId: Types.ObjectId) {
  // Category averages across all completed submissions
  const [avgAgg] = await Submission.aggregate([
    { $match: { ...completedFilter(userId), scoreBreakdown: { $ne: null } } },
    {
      $group: {
        _id: null,
        style: { $avg: '$scoreBreakdown.style' },
        bestPractices: { $avg: '$scoreBreakdown.bestPractices' },
        logic: { $avg: '$scoreBreakdown.logic' },
        readability: { $avg: '$scoreBreakdown.readability' },
      },
    },
  ]);

  const categoryAverages = avgAgg
    ? {
        style: Math.round(avgAgg.style ?? 0),
        bestPractices: Math.round(avgAgg.bestPractices ?? 0),
        logic: Math.round(avgAgg.logic ?? 0),
        readability: Math.round(avgAgg.readability ?? 0),
      }
    : null;

  // Top 5 recurring issues grouped by normalised message
  const submissionIds = await Submission.find(completedFilter(userId)).distinct('_id');

  const rawIssues = await Issue.find(
    { submissionId: { $in: submissionIds }, message: { $ne: null } },
  )
    .select('message category severity submissionId')
    .populate<{ submissionId: { createdAt: Date } }>('submissionId', 'createdAt')
    .lean();

  // Group by normalised key, track most recent original message
  const groups = new Map<string, {
    message: string;
    category: string;
    severity: string;
    count: number;
    lastSeenAt: Date;
  }>();

  for (const issue of rawIssues) {
    if (!issue.message) continue;
    const key = normaliseMessage(issue.message);
    const existing = groups.get(key);
    const createdAt = (issue.submissionId as unknown as { createdAt: Date }).createdAt;

    if (existing) {
      existing.count++;
      if (createdAt > existing.lastSeenAt) {
        existing.message = issue.message;
        existing.category = issue.category;
        existing.severity = issue.severity;
        existing.lastSeenAt = createdAt;
      }
    } else {
      groups.set(key, {
        message: issue.message,
        category: issue.category,
        severity: issue.severity,
        count: 1,
        lastSeenAt: createdAt,
      });
    }
  }

  const topIssues = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ message, category, severity, count, lastSeenAt }) => ({
      message,
      category,
      severity,
      count,
      lastSeenAt,
    }));

  return { categoryAverages, topIssues };
}
