import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { FakeLLMClient } from '../src/services/llm/FakeLLMClient';

const app = createApp({ silent: true, llmClient: new FakeLLMClient() });
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

async function registerAndGetToken(
  email: string,
  displayName = 'User',
): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', displayName });
  return res.body.data.accessToken;
}

// ── Submission ownership ────────────────────────────────────

describe('Submission ownership', () => {
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    tokenA = await registerAndGetToken('alice@example.com', 'Alice');
    tokenB = await registerAndGetToken('bob@example.com', 'Bob');
  });

  it('user can create and read their own submission', async () => {
    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'const x = 1;' });

    expect(create.status).toBe(201);

    const get = await request(app)
      .get(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(get.status).toBe(200);
    expect(get.body.data.submission.code).toBe('const x = 1;');
  });

  it('user cannot read another user\'s submission', async () => {
    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'const x = 1;' });

    const res = await request(app)
      .get(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('user cannot delete another user\'s submission', async () => {
    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'const x = 1;' });

    const res = await request(app)
      .delete(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('list only returns own submissions', async () => {
    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'alice code' });

    await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ code: 'bob code' });

    const listA = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.data[0].code).toBe('alice code');

    const listB = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(listB.body.data).toHaveLength(1);
    expect(listB.body.data[0].code).toBe('bob code');
  });

  it('user can delete their own submission', async () => {
    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ code: 'const x = 1;' });

    const res = await request(app)
      .delete(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Should not appear in list anymore
    const list = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(list.body.data).toHaveLength(0);
  });

  it('returns 404 for non-existent submission', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/submissions');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });
});

// ── requireRole middleware ───────────────────────────────────

describe('requireRole middleware', () => {
  it('regular user gets 403 on admin-only route (via role check)', async () => {
    const token = await registerAndGetToken('regular@example.com');

    // We test requireRole indirectly — admin can read any submission
    // but the middleware itself is exported and usable. For now, verify
    // that a non-admin gets AUTH_FORBIDDEN when accessing others' data.
    const adminToken = await registerAndGetToken('admin@example.com', 'Admin');

    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'admin code' });

    const res = await request(app)
      .get(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('admin can read any user\'s submission', async () => {
    const userToken = await registerAndGetToken('user@example.com');

    const create = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'user code' });

    // Promote user to admin directly in DB
    const { User } = await import('../src/models/User');
    const adminUser = await User.findOneAndUpdate(
      { email: 'admin-super@example.com' },
      {
        email: 'admin-super@example.com',
        passwordHash: 'unused',
        displayName: 'Admin',
        role: 'admin',
      },
      { upsert: true, new: true },
    );

    // Sign a token with admin role
    const jwt = await import('jsonwebtoken');
    const adminAccessToken = jwt.default.sign(
      { sub: adminUser._id.toString(), role: 'admin' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '15m' },
    );

    const res = await request(app)
      .get(`/api/submissions/${create.body.data.submission._id}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.submission.code).toBe('user code');
  });
});
