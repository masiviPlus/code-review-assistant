import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { RefreshToken } from '../src/models/RefreshToken';

const app = createApp({ silent: true });
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await mongoose.connection.close();
  await mongo.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

const validUser = {
  email: 'test@example.com',
  password: 'password123',
  displayName: 'Test User',
};

function extractRefreshCookie(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return undefined;
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  const match = arr.find((c: string) => c.startsWith('refresh_token='));
  if (!match) return undefined;
  return match.split(';')[0].split('=').slice(1).join('=');
}

// ── Register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(res.body.data.user.displayName).toBe(validUser.displayName);
    expect(res.body.data.user.role).toBe('user');
    expect(extractRefreshCookie(res)).toBeDefined();
  });

  it('sets httpOnly cookie with correct flags', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    const cookies = res.headers['set-cookie'];
    const cookie = (Array.isArray(cookies) ? cookies : [cookies]).find((c: string) =>
      c.startsWith('refresh_token='),
    );

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not return passwordHash', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });
});

// ── Login ───────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  it('returns tokens for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(validUser.email);
    expect(extractRefreshCookie(res)).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

// ── Refresh ─────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  let refreshCookie: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    refreshCookie = extractRefreshCookie(res)!;
  });

  it('returns new access token and rotates refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();

    const newCookie = extractRefreshCookie(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(refreshCookie);
  });

  it('revokes old refresh token after rotation', async () => {
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshCookie}`);

    // Old token should be revoked
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${refreshCookie}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects missing refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects expired refresh token', async () => {
    const expired = jwt.sign(
      { sub: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '0s' },
    );

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });
});

// ── Logout ──────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears refresh cookie and revokes token', async () => {
    const regRes = await request(app).post('/api/auth/register').send(validUser);
    const refreshCookie = extractRefreshCookie(regRes)!;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `refresh_token=${refreshCookie}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Refresh token should be revoked in DB
    const count = await RefreshToken.countDocuments({ revokedAt: null });
    expect(count).toBe(0);
  });

  it('succeeds even without a cookie', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Me ──────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);
    accessToken = res.body.data.accessToken;
  });

  it('returns current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.email).toBe(validUser.email);
    expect(res.body.data.displayName).toBe(validUser.displayName);
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  it('rejects missing token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('rejects expired token', async () => {
    const expired = jwt.sign(
      { sub: new mongoose.Types.ObjectId().toString(), role: 'user' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '0s' },
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });
});
