import { Submission, completedFilter } from '../../models/Submission';
import { Issue } from '../../models/Issue';
import type { AchievementChecker, CheckerContext, AchievementProgress } from './types';

// ── Individual achievement checkers (Strategy pattern) ──────
//
// Each checker is a concrete strategy that knows how to evaluate
// one achievement criterion. The engine in index.ts iterates
// over the exported `checkers` array — adding a new achievement
// is as simple as appending another object to the list.

// ── First Steps ─────────────────────────────────────────────

const firstSteps: AchievementChecker = {
  code: 'first_steps',

  async check(ctx) {
    return ctx.totalSubmissions >= 1;
  },

  async progress(ctx) {
    return { current: Math.min(ctx.totalSubmissions, 1), target: 1 };
  },
};

// ── Style Master ────────────────────────────────────────────

const STYLE_MASTER_THRESHOLD = 90;
const STYLE_MASTER_COUNT = 5;

const styleMaster: AchievementChecker = {
  code: 'style_master',

  async check(ctx) {
    const count = await countHighStyleSubmissions(ctx);
    return count >= STYLE_MASTER_COUNT;
  },

  async progress(ctx) {
    const count = await countHighStyleSubmissions(ctx);
    return { current: Math.min(count, STYLE_MASTER_COUNT), target: STYLE_MASTER_COUNT };
  },
};

async function countHighStyleSubmissions(ctx: CheckerContext): Promise<number> {
  return Submission.countDocuments({
    ...completedFilter(ctx.userId),
    'scoreBreakdown.style': { $gte: STYLE_MASTER_THRESHOLD },
  });
}

// ── Bug Hunter ──────────────────────────────────────────────

const BUG_HUNTER_THRESHOLD = 5;

const bugHunter: AchievementChecker = {
  code: 'bug_hunter',

  async check(ctx) {
    return ctx.errorIssueCount >= BUG_HUNTER_THRESHOLD;
  },

  async progress(ctx) {
    // Show the best single-submission error count the user has ever had
    const best = await bestErrorCount(ctx);
    return { current: Math.min(best, BUG_HUNTER_THRESHOLD), target: BUG_HUNTER_THRESHOLD };
  },
};

async function bestErrorCount(ctx: CheckerContext): Promise<number> {
  const pipeline = [
    {
      $match: {
        submissionId: {
          $in: await Submission.find(completedFilter(ctx.userId)).distinct('_id'),
        },
        severity: 'error',
      },
    },
    { $group: { _id: '$submissionId', count: { $sum: 1 } } },
    { $sort: { count: -1 as const } },
    { $limit: 1 },
  ];

  const [top] = await Issue.aggregate(pipeline);
  return top?.count ?? 0;
}

// ── Consistent (7-day streak) ───────────────────────────────

const CONSISTENT_DAYS = 7;

const consistent: AchievementChecker = {
  code: 'consistent',

  async check(ctx) {
    return ctx.streak >= CONSISTENT_DAYS;
  },

  async progress(ctx) {
    return { current: Math.min(ctx.streak, CONSISTENT_DAYS), target: CONSISTENT_DAYS };
  },
};

// ── Marathoner (30-day streak) ──────────────────────────────

const MARATHONER_DAYS = 30;

const marathoner: AchievementChecker = {
  code: 'marathoner',

  async check(ctx) {
    return ctx.streak >= MARATHONER_DAYS;
  },

  async progress(ctx) {
    return { current: Math.min(ctx.streak, MARATHONER_DAYS), target: MARATHONER_DAYS };
  },
};

// ── Polyglot ────────────────────────────────────────────────

const POLYGLOT_LANGUAGES = 3;

const polyglot: AchievementChecker = {
  code: 'polyglot',

  async check(ctx) {
    const count = await distinctLanguageCount(ctx);
    return count >= POLYGLOT_LANGUAGES;
  },

  async progress(ctx) {
    const count = await distinctLanguageCount(ctx);
    return { current: Math.min(count, POLYGLOT_LANGUAGES), target: POLYGLOT_LANGUAGES };
  },
};

async function distinctLanguageCount(ctx: CheckerContext): Promise<number> {
  const languages: string[] = await Submission.distinct('language', completedFilter(ctx.userId));
  return languages.length;
}

// ── Perfectionist ───────────────────────────────────────────

const PERFECT_SCORE = 100;
const MIN_LINES = 30;

const perfectionist: AchievementChecker = {
  code: 'perfectionist',

  async check(ctx) {
    const lines = ctx.submission.code.split('\n').length;
    return ctx.submission.scoreOverall === PERFECT_SCORE && lines > MIN_LINES;
  },

  async progress(ctx) {
    // Binary: either you've done it or you haven't
    const exists = await Submission.exists({
      ...completedFilter(ctx.userId),
      scoreOverall: PERFECT_SCORE,
      // We can't filter by line count in Mongo easily, so check in memory
      // for the current submission. For progress display, show 0 or 1.
    });

    // Check if any past 100-score submission was > 30 lines
    if (exists) {
      const perfect = await Submission.findOne({
        ...completedFilter(ctx.userId),
        scoreOverall: PERFECT_SCORE,
      }).lean();
      if (perfect && perfect.code.split('\n').length > MIN_LINES) {
        return { current: 1, target: 1 };
      }
    }

    return { current: 0, target: 1 };
  },
};

// ── Reformed ────────────────────────────────────────────────

const REFORMED_IMPROVEMENT = 30;

const reformed: AchievementChecker = {
  code: 'reformed',

  async check(ctx) {
    return hasImprovedEnough(ctx);
  },

  async progress(ctx) {
    const bestImprovement = await getBestImprovement(ctx);
    return {
      current: Math.min(bestImprovement, REFORMED_IMPROVEMENT),
      target: REFORMED_IMPROVEMENT,
    };
  },
};

/**
 * Checks whether the latest submission's score is 30+ points
 * higher than any earlier submission by the same user.
 */
async function hasImprovedEnough(ctx: CheckerContext): Promise<boolean> {
  const worstPrior = await Submission.findOne({
    ...completedFilter(ctx.userId),
    _id: { $ne: ctx.submission._id },
  })
    .sort({ scoreOverall: 1 })
    .select('scoreOverall')
    .lean();

  if (!worstPrior || worstPrior.scoreOverall == null) return false;
  return ctx.submission.scoreOverall - worstPrior.scoreOverall >= REFORMED_IMPROVEMENT;
}

/** Best improvement between any two submissions by this user. */
async function getBestImprovement(ctx: CheckerContext): Promise<number> {
  const scoreFilter = { ...completedFilter(ctx.userId), scoreOverall: { $ne: null } };
  const [worst, best] = await Promise.all([
    Submission.findOne(scoreFilter)
      .sort({ scoreOverall: 1 })
      .select('scoreOverall')
      .lean(),
    Submission.findOne(scoreFilter)
      .sort({ scoreOverall: -1 })
      .select('scoreOverall')
      .lean(),
  ]);

  if (!worst || !best) return 0;
  return Math.max(0, (best.scoreOverall ?? 0) - (worst.scoreOverall ?? 0));
}

// ── Exported registry ───────────────────────────────────────

export const checkers: AchievementChecker[] = [
  firstSteps,
  styleMaster,
  bugHunter,
  consistent,
  marathoner,
  polyglot,
  perfectionist,
  reformed,
];
