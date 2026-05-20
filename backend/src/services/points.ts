import { Types } from 'mongoose';
import { PointsLedger } from '../models/PointsLedger';
import { Submission } from '../models/Submission';

// ── Level thresholds ────────────────────────────────────────

const LEVELS = [
  { level: 1, threshold: 0 },
  { level: 2, threshold: 50 },
  { level: 3, threshold: 150 },
  { level: 4, threshold: 400 },
  { level: 5, threshold: 1000 },
] as const;

// ── Point values ────────────────────────────────────────────

const BASE_POINTS = 10;
const SCORE_90_BONUS = 20;
const SCORE_80_BONUS = 10;
const STREAK_BONUS_PER_DAY = 5;
const STREAK_BONUS_CAP = 25;
const FIRST_OF_WEEK_BONUS = 5;

// ── Helpers ─────────────────────────────────────────────────

/** Start of today in UTC */
function utcStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** ISO week start (Monday 00:00 UTC) for a given date */
function isoWeekStart(date: Date = new Date()): Date {
  const d = utcStartOfDay(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// ── Streak calculation ──────────────────────────────────────

/**
 * Counts consecutive calendar days (UTC) with at least one
 * completed submission, looking backwards from today.
 */
export async function computeStreak(userId: Types.ObjectId): Promise<number> {
  // Get distinct submission dates (UTC day) in descending order
  const pipeline = [
    {
      $match: {
        userId,
        status: 'complete',
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
        },
      },
    },
    { $sort: { _id: -1 as const } },
  ];

  const days: { _id: string }[] = await Submission.aggregate(pipeline);
  if (days.length === 0) return 0;

  const today = utcStartOfDay();
  const todayStr = today.toISOString().slice(0, 10);

  // Streak must include today or yesterday to be active
  const mostRecent = days[0]._id;
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (mostRecent !== todayStr && mostRecent !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]._id + 'T00:00:00Z');
    const curr = new Date(days[i]._id + 'T00:00:00Z');
    const diffMs = prev.getTime() - curr.getTime();
    if (diffMs === 86_400_000) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Award points on submission completion ───────────────────

export async function awardSubmissionPoints(
  userId: Types.ObjectId,
  submissionId: Types.ObjectId,
  scoreOverall: number,
): Promise<void> {
  const entries: { userId: Types.ObjectId; submissionId: Types.ObjectId; amount: number; reason: string }[] = [];

  // 1. Base points
  entries.push({ userId, submissionId, amount: BASE_POINTS, reason: 'submission_complete' });

  // 2. Score bonus (mutually exclusive)
  if (scoreOverall >= 90) {
    entries.push({ userId, submissionId, amount: SCORE_90_BONUS, reason: 'score_bonus_90' });
  } else if (scoreOverall >= 80) {
    entries.push({ userId, submissionId, amount: SCORE_80_BONUS, reason: 'score_bonus_80' });
  }

  // 3. Daily streak bonus
  const streak = await computeStreak(userId);
  if (streak > 1) {
    const streakBonus = Math.min((streak - 1) * STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP);
    entries.push({ userId, submissionId, amount: streakBonus, reason: 'daily_streak' });
  }

  // 4. First submission of the week
  const weekStart = isoWeekStart();
  const existingWeekAward = await PointsLedger.findOne({
    userId,
    reason: 'first_of_week',
    createdAt: { $gte: weekStart },
  }).lean();

  if (!existingWeekAward) {
    entries.push({ userId, submissionId, amount: FIRST_OF_WEEK_BONUS, reason: 'first_of_week' });
  }

  await PointsLedger.insertMany(entries);
}

// ── Points summary for GET /api/points/me ───────────────────

export interface PointsSummary {
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number | null;
  streak: number;
  recentLedger: {
    submissionId?: Types.ObjectId | null;
    amount: number;
    reason: string;
    createdAt: Date;
  }[];
}

export async function getPointsSummary(userId: Types.ObjectId): Promise<PointsSummary> {
  // Total via aggregation
  const [totalAgg] = await PointsLedger.aggregate([
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalPoints: number = totalAgg?.total ?? 0;

  // Level calculation
  let currentLevel = 1;
  let pointsToNextLevel: number | null = LEVELS[1].threshold;

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalPoints >= LEVELS[i].threshold) {
      currentLevel = LEVELS[i].level;
      const next = LEVELS[i + 1];
      pointsToNextLevel = next ? next.threshold - totalPoints : null;
      break;
    }
  }

  // Streak
  const streak = await computeStreak(userId);

  // Recent ledger (last 20 entries)
  const recentLedger = await PointsLedger.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('submissionId amount reason createdAt')
    .lean();

  return { totalPoints, currentLevel, pointsToNextLevel, streak, recentLedger };
}
