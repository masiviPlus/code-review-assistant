import { Request, Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Submission } from '../models/Submission';
import { Issue } from '../models/Issue';
import { requireAuth } from '../middleware/requireAuth';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

const router = Router();

// ── Rate limiting (per-user, keyed by userId from JWT) ───────

const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: env.NODE_ENV === 'test' ? 10_000 : 20,
  keyGenerator: (req: Request) => req.user!.userId.toString(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Submission limit reached, try again later' },
  },
});

// ── Zod schemas ──────────────────────────────────────────────

const createSchema = z.object({
  code: z.string().min(1).max(10_000),
  language: z.enum(['javascript']).default('javascript'),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────

function assertOwnership(docUserId: Types.ObjectId, req: Request): void {
  if (!docUserId.equals(req.user!.userId) && req.user!.role !== 'admin') {
    throw new AppError('You do not have access to this resource', 'AUTH_FORBIDDEN', 403);
  }
}

// ── Hardcoded fake review (replaced by LLM later) ───────────

function generateFakeReview(code: string) {
  const lines = code.split('\n');
  const scoreBreakdown = {
    style: 72,
    bestPractices: 65,
    logic: 80,
    readability: 78,
  };
  const scoreOverall = Math.round(
    (scoreBreakdown.style +
      scoreBreakdown.bestPractices +
      scoreBreakdown.logic +
      scoreBreakdown.readability) /
      4,
  );

  const issues = [
    {
      severity: 'warning' as const,
      category: 'style' as const,
      lineNumber: 1,
      message: 'Consider using descriptive variable names',
      suggestion: 'Rename short variable names to reflect their purpose.',
    },
    {
      severity: 'info' as const,
      category: 'best_practice' as const,
      lineNumber: Math.min(lines.length, 3),
      message: 'Use const instead of let when the variable is never reassigned',
      suggestion: 'Replace let with const for variables that do not change.',
    },
    {
      severity: 'error' as const,
      category: 'logic' as const,
      lineNumber: Math.min(lines.length, 5),
      message: 'Potential null reference detected',
      suggestion: 'Add a null check before accessing the property.',
    },
  ];

  return { scoreOverall, scoreBreakdown, issues };
}

// All routes require authentication
router.use(requireAuth);

// ── POST /submissions ────────────────────────────────────────

router.post('/', submissionLimiter, async (req, res) => {
  const body = createSchema.parse(req.body);
  const review = generateFakeReview(body.code);

  const submission = await Submission.create({
    userId: req.user!.userId,
    code: body.code,
    language: body.language,
    status: 'complete',
    scoreOverall: review.scoreOverall,
    scoreBreakdown: review.scoreBreakdown,
  });

  const issues = await Issue.insertMany(
    review.issues.map((issue) => ({
      ...issue,
      submissionId: submission._id,
    })),
  );

  res.status(201).json({
    ok: true,
    data: { submission, issues },
  });
});

// ── GET /submissions ─────────────────────────────────────────

router.get('/', async (req, res) => {
  const { limit, cursor } = listSchema.parse(req.query);

  const filter: Record<string, unknown> = {
    userId: req.user!.userId,
    deletedAt: null,
  };

  if (cursor) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const submissions = await Submission.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = submissions.length > limit;
  if (hasMore) submissions.pop();

  const nextCursor = hasMore
    ? submissions[submissions.length - 1]._id.toString()
    : null;

  res.json({
    ok: true,
    data: submissions,
    pagination: { nextCursor },
  });
});

// ── GET /submissions/:id ─────────────────────────────────────

router.get('/:id', async (req, res) => {
  const submission = await Submission.findOne({
    _id: req.params.id,
    deletedAt: null,
  }).lean();

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND', 404);
  }

  assertOwnership(submission.userId, req);

  const issues = await Issue.find({ submissionId: submission._id }).lean();

  res.json({
    ok: true,
    data: { submission, issues },
  });
});

// ── DELETE /submissions/:id (soft delete) ────────────────────

router.delete('/:id', async (req, res) => {
  const submission = await Submission.findOne({
    _id: req.params.id,
    deletedAt: null,
  });

  if (!submission) {
    throw new AppError('Submission not found', 'NOT_FOUND', 404);
  }

  assertOwnership(submission.userId, req);

  submission.deletedAt = new Date();
  await submission.save();

  res.json({ ok: true });
});

export default router;
