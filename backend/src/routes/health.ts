import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    data: {
      uptime: process.uptime(),
    },
  });
});

export default router;
