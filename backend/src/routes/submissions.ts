import { Router } from 'express';
import { z } from 'zod';
import { Submission } from '../models/Submission';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const createSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1).optional(),
});

function throwForbidden(): never {
  const err = new Error('You do not have access to this resource') as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 403;
  err.code = 'AUTH_FORBIDDEN';
  throw err;
}

function throwNotFound(): never {
  const err = new Error('Submission not found') as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  throw err;
}

// All routes require authentication
router.use(requireAuth);

// ── POST /submissions ────────────────────────────────────────

router.post('/', async (req, res) => {
  const body = createSchema.parse(req.body);

  const submission = await Submission.create({
    userId: req.user!.userId,
    code: body.code,
    language: body.language,
  });

  res.status(201).json({
    ok: true,
    data: submission,
  });
});

// ── GET /submissions ─────────────────────────────────────────

router.get('/', async (req, res) => {
  const submissions = await Submission.find({
    userId: req.user!.userId,
    deletedAt: null,
  }).sort({ createdAt: -1 });

  res.json({
    ok: true,
    data: submissions,
  });
});

// ── GET /submissions/:id ─────────────────────────────────────

router.get('/:id', async (req, res) => {
  const submission = await Submission.findOne({
    _id: req.params.id,
    deletedAt: null,
  });

  if (!submission) {
    throwNotFound();
  }

  if (!submission.userId.equals(req.user!.userId) && req.user!.role !== 'admin') {
    throwForbidden();
  }

  res.json({
    ok: true,
    data: submission,
  });
});

// ── DELETE /submissions/:id (soft delete) ────────────────────

router.delete('/:id', async (req, res) => {
  const submission = await Submission.findOne({
    _id: req.params.id,
    deletedAt: null,
  });

  if (!submission) {
    throwNotFound();
  }

  if (!submission.userId.equals(req.user!.userId) && req.user!.role !== 'admin') {
    throwForbidden();
  }

  submission.deletedAt = new Date();
  await submission.save();

  res.json({ ok: true });
});

export default router;
