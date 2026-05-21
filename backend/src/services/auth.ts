import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

// ── Constants ────────────────────────────────────────────────

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Token helpers ────────────────────────────────────────────

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

// ── Serialisation ────────────────────────────────────────────

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

// ── Return types ─────────────────────────────────────────────

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: ReturnType<typeof serializeUser>;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

// ── register ─────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new AppError('Email already in use', 'AUTH_EMAIL_TAKEN', 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, displayName });

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  return { accessToken, refreshToken, user: serializeUser(user) };
}

// ── login ────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 'AUTH_INVALID_CREDENTIALS', 401);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  return { accessToken, refreshToken, user: serializeUser(user) };
}

// ── refreshTokens ────────────────────────────────────────────

export async function refreshTokens(rawToken: string): Promise<RefreshResult> {
  let payload: { sub: string };
  try {
    payload = jwt.verify(rawToken, env.JWT_REFRESH_SECRET) as { sub: string };
  } catch (err) {
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
    throw new AppError('Refresh token revoked or not found', 'AUTH_TOKEN_INVALID', 401);
  }

  stored.revokedAt = new Date();
  await stored.save();

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role!);
  const refreshToken = signRefreshToken(user._id.toString());
  await persistRefreshToken(user._id.toString(), refreshToken);

  return { accessToken, refreshToken };
}

// ── logout ───────────────────────────────────────────────────

export async function logout(rawToken: string | undefined): Promise<void> {
  if (rawToken) {
    await RefreshToken.findOneAndUpdate(
      { tokenHash: hashToken(rawToken), revokedAt: null },
      { revokedAt: new Date() },
    );
  }
}

// ── getMe ────────────────────────────────────────────────────

export async function getMe(userId: string) {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    throw new AppError('User not found', 'AUTH_TOKEN_INVALID', 401);
  }

  return {
    ...serializeUser(user),
    totalPoints: user.totalPoints,
    createdAt: user.createdAt,
  };
}
