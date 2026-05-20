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
import { applyScoring } from '../services/scoring';
import { awardSubmissionPoints } from '../services/points';

const logger = pino({ name: 'submissions' });

const LLM_TIMEOUT_MS = 30_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LLM call timed out')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Router factory ───────────────────────────────────────────
// Accepts an LLMClient so we can inject FakeLLMClient in tests
// and ClaudeClient in production.

export function createSubmissionsRouter(llmClient: LLMClient) {
  const router = Router();

  // All routes require authentication
  router.use(requireAuth);

  // ── POST /submissions ──────────────────────────────────────
  //
  // Queue architecture note:
  // Currently the LLM call runs inline (in-memory promise). To scale,
  // replace the inline call with a job enqueue (e.g. BullMQ + Redis):
  //   1. Save submission with status 'analysing', return 202 immediately.
  //   2. A worker picks up the job, calls llmClient.analyseCode(),
  //      updates the submission in Mongo, and emits a completion event.
  //   3. Frontend polls GET /submissions/:id or listens via WebSocket.
  // The LLMClient interface stays the same — only the orchestration changes.

  router.post('/', submissionLimiter, async (req, res) => {
    const body = createSchema.parse(req.body);

    // Step 1: persist submission immediately so user code is never lost
    const submission = await Submission.create({
      userId: req.user!.userId,
      code: body.code,
      language: body.language,
      status: 'analysing',
    });

    // Step 2: call LLM with timeout
    try {
      const rawResult = await withTimeout(
        llmClient.analyseCode(body.code, body.language),
        LLM_TIMEOUT_MS,
      );

      const codeLineCount = body.code.split('\n').length;
      const result = applyScoring(rawResult, codeLineCount);

      // Step 3: save issues
      const issues = await Issue.insertMany(
        result.issues.map((issue) => ({
          ...issue,
          submissionId: submission._id,
        })),
      );

      // Step 4: update submission with scores
      submission.status = 'complete';
      submission.scoreOverall = result.scoreOverall;
      submission.scoreBreakdown = result.scoreBreakdown;
      submission.summary = result.summary;
      await submission.save();

      // Step 5: award points (fire-and-forget — don't block the response)
      awardSubmissionPoints(req.user!.userId, submission._id, result.scoreOverall)
        .catch((err) => logger.error({ err, submissionId: submission._id }, 'Failed to award points'));

      res.status(201).json({
        ok: true,
        data: { submission, issues },
      });
    } catch (err) {
      // Mark as failed but preserve the user's code
      submission.status = 'failed';
      await submission.save();

      const message = err instanceof Error ? err.message : 'Analysis failed';
      logger.error({ err, submissionId: submission._id }, 'LLM analysis failed');

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
