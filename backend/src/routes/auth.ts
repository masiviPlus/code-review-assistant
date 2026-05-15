import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { env } from '../config/env';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

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

// ── Helpers ──────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
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

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshCookie(res: import('express').Response): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

function throwAuth(message: string, code: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = statusCode;
  err.code = code;
  throw err;
}

// ── POST /auth/register ─────────────────────────────────────

router.post('/register', async (req, res) => {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throwAuth('Email already in use', 'AUTH_EMAIL_TAKEN', 409);
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
    data: {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    },
  });
});

// ── POST /auth/login ─────────────────────────────────────────

router.post('/login', async (req, res) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email.toLowerCase() });
  if (!user) {
    throwAuth('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throwAuth('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  setRefreshCookie(res, refreshToken);
  res.json({
    ok: true,
    data: {
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    },
  });
});

// ── POST /auth/refresh ───────────────────────────────────────

router.post('/refresh', async (req, res) => {
  const rawToken: string | undefined = req.cookies?.refresh_token;
  if (!rawToken) {
    throwAuth('Missing refresh token', 'AUTH_TOKEN_INVALID', 401);
  }

  let payload: { sub: string };
  try {
    payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch (err) {
    clearRefreshCookie(res);
    const isExpired = err instanceof jwt.TokenExpiredError;
    throwAuth(
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
    throwAuth('Refresh token revoked or not found', 'AUTH_TOKEN_INVALID', 401);
  }

  // Revoke old token
  stored.revokedAt = new Date();
  await stored.save();

  const user = await User.findById(payload.sub);
  if (!user) {
    clearRefreshCookie(res);
    throwAuth('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  // Issue new pair
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
    throwAuth('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  res.json({
    ok: true,
    data: {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      totalPoints: user.totalPoints,
      createdAt: user.createdAt,
    },
  });
});

export default router;
