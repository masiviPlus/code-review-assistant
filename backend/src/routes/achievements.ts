import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getAchievementsForUser } from '../services/achievements';

const router = Router();

router.use(requireAuth);

// ── GET /achievements ───────────────────────────────────────
// Returns every seeded achievement with locked/unlocked status
// and progress toward each for the authenticated user.

router.get('/', async (req, res) => {
  const achievements = await getAchievementsForUser(req.user!.userId);
  res.json({ ok: true, data: achievements });
});

export default router;
