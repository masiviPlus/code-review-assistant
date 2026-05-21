import { Request, Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import { Submission } from '../models/Submission';
import { Issue } from '../models/Issue';
import { requireAuth } from '../middleware/requireAuth';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';
import type { LLMClient } from '../services/llm/types';
import { analyseAndScore, getStats } from '../services/submissions';

const logger = pino({ name: 'submissions' });

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

// ── Router factory ───────────────────────────────────────────

export function createSubmissionsRouter(llmClient: LLMClient) {
  const router = Router();

  router.use(requireAuth);

  // ── POST /submissions ──────────────────────────────────────

  router.post('/', submissionLimiter, async (req, res) => {
    const body = createSchema.parse(req.body);

    try {
      const result = await analyseAndScore(
        req.user!.userId,
        body.code,
        body.language,
        llmClient,
      );

      res.status(201).json({ ok: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      logger.error({ err }, 'LLM analysis failed');

      throw new AppError(
        `Code analysis failed: ${message}`,
        'ANALYSIS_FAILED',
        502,
      );
    }
  });

  // ── GET /submissions ───────────────────────────────────────

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

  // ── GET /submissions/stats ─────────────────────────────────

  router.get('/stats', async (req, res) => {
    const data = await getStats(req.user!.userId);
    res.json({ ok: true, data });
  });

  // ── GET /submissions/:id ───────────────────────────────────

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

  // ── DELETE /submissions/:id (soft delete) ──────────────────

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

  return router;
}
