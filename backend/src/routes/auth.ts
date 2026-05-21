import { Router, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { requireAuth } from '../middleware/requireAuth';
import { AppError } from '../errors/AppError';
import { register, login, refreshTokens, logout, getMe } from '../services/auth';

const router = Router();

// ── Rate limiting ────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' },
  },
});

// ── Zod schemas ──────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Cookie helpers ──────────────────────────────────────────

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

// ── POST /auth/register ─────────────────────────────────────

router.post('/register', authLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);
  const result = await register(body.email, body.password, body.displayName);

  setRefreshCookie(res, result.refreshToken);
  res.status(201).json({
    ok: true,
    data: { accessToken: result.accessToken, user: result.user },
  });
});

// ── POST /auth/login ─────────────────────────────────────────

router.post('/login', authLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await login(body.email, body.password);

  setRefreshCookie(res, result.refreshToken);
  res.json({
    ok: true,
    data: { accessToken: result.accessToken, user: result.user },
  });
});

// ── POST /auth/refresh ───────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const rawToken: string | undefined = req.cookies?.refresh_token;
  if (!rawToken) {
    throw new AppError('Missing refresh token', 'AUTH_TOKEN_INVALID', 401);
  }

  try {
    const result = await refreshTokens(rawToken);

    setRefreshCookie(res, result.refreshToken);
    res.json({
      ok: true,
      data: { accessToken: result.accessToken },
    });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

// ── POST /auth/logout ────────────────────────────────────────

router.post('/logout', async (req, res) => {
  await logout(req.cookies?.refresh_token);

  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ── GET /auth/me ─────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  const data = await getMe(req.user!.userId.toString());
  res.json({ ok: true, data });
});

export default router;
