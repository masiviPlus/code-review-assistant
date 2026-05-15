import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { env } from '../config/env';
import { requireAuth } from '../middleware/requireAuth';
import { AppError } from '../errors/AppError';

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

// ── Constants ────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function persistRefreshToken(userId: string, rawToken: string): Promise<void> {
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
}

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

interface SerializableUser {
  _id: unknown;
  email: string;
  displayName: string;
  role?: string;
  totalPoints?: number;
  createdAt?: Date;
}

function serializeUser(user: SerializableUser) {
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

// ── POST /auth/register ─────────────────────────────────────

router.post('/register', authLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already in use', 'AUTH_EMAIL_TAKEN', 409);
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await User.create({
    email: body.email,
    passwordHash,
    displayName: body.displayName,
  });

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  setRefreshCookie(res, refreshToken);
  res.status(201).json({
    ok: true,
    data: { accessToken, user: serializeUser(user) },
  });
});

// ── POST /auth/login ─────────────────────────────────────────

router.post('/login', authLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user) {
    throw new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  setRefreshCookie(res, refreshToken);
  res.json({
    ok: true,
    data: { accessToken, user: serializeUser(user) },
  });
});

// ── POST /auth/refresh ───────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const rawToken: string | undefined = req.cookies?.refresh_token;
  if (!rawToken) {
    throw new AppError('Missing refresh token', 'AUTH_TOKEN_INVALID', 401);
  }

  let payload: { sub: string };
  try {
    payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch (err) {
    clearRefreshCookie(res);
    const isExpired = err instanceof jwt.TokenExpiredError;
    throw new AppError(
      isExpired ? 'Refresh token expired' : 'Invalid refresh token',
      isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      401,
    );
  }

  const stored = await RefreshToken.findOne({
    tokenHash: hashToken(rawToken),
    revokedAt: null,
  });

  if (!stored) {
    clearRefreshCookie(res);
    throw new AppError('Refresh token revoked or not found', 'AUTH_TOKEN_INVALID', 401);
  }

  stored.revokedAt = new Date();
  await stored.save();

  const user = await User.findById(payload.sub);
  if (!user) {
    clearRefreshCookie(res);
    throw new AppError('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const newRefreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), newRefreshToken);

  setRefreshCookie(res, newRefreshToken);
  res.json({
    ok: true,
    data: { accessToken },
  });
});

// ── POST /auth/logout ────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const rawToken: string | undefined = req.cookies?.refresh_token;

  if (rawToken) {
    await RefreshToken.findOneAndUpdate(
      { tokenHash: hashToken(rawToken), revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ── GET /auth/me ─────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.userId).select('-passwordHash');
  if (!user) {
    throw new AppError('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  res.json({
    ok: true,
    data: {
      ...serializeUser(user),
      totalPoints: user.totalPoints,
      createdAt: user.createdAt,
    },
  });
});

export default router;
