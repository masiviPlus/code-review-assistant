import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getPointsSummary } from '../services/points';

const router = Router();

router.use(requireAuth);

// ── GET /points/me ───────────────────────────────────────────

router.get('/me', async (req, res) => {
  const summary = await getPointsSummary(req.user!.userId);
  res.json({ ok: true, data: summary });
});

export default router;
