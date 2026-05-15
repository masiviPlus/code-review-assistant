import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import { Issue } from '../src/models/Issue';
import { Submission } from '../src/models/Submission';

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

let token: string;

async function registerAndGetToken(): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'user@example.com', password: 'password123', displayName: 'User' });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  token = await registerAndGetToken();
});

// ── POST /api/submissions ────────────────────────────────────

describe('POST /api/submissions', () => {
  it('creates submission with fake review and issues', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;\nlet y = 2;\nconst z = x + y;\n' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const { submission, issues } = res.body.data;
    expect(submission.code).toBe('const x = 1;\nlet y = 2;\nconst z = x + y;\n');
    expect(submission.language).toBe('javascript');
    expect(submission.status).toBe('complete');
    expect(submission.scoreOverall).toEqual(expect.any(Number));
    expect(submission.scoreBreakdown).toEqual(
      expect.objectContaining({
        style: expect.any(Number),
        bestPractices: expect.any(Number),
        logic: expect.any(Number),
        readability: expect.any(Number),
      }),
    );

    expect(issues).toHaveLength(3);
    issues.forEach((issue: Record<string, unknown>) => {
      expect(issue.submissionId).toBe(submission._id);
      expect(issue.severity).toBeDefined();
      expect(issue.category).toBeDefined();
      expect(issue.message).toBeDefined();
    });
  });

  it('persists issues to the database', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    const dbIssues = await Issue.find({ submissionId: res.body.data.submission._id });
    expect(dbIssues).toHaveLength(3);
  });

  it('rejects empty code', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects code over 10,000 characters', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'x'.repeat(10_001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts code at exactly 10,000 characters', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'x'.repeat(10_000) });

    expect(res.status).toBe(201);
  });

  it('defaults language to javascript', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    expect(res.body.data.submission.language).toBe('javascript');
  });
});

// ── GET /api/submissions (list with pagination) ──────────────

describe('GET /api/submissions', () => {
  async function createSubmissions(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      await request(app)
        .post('/api/submissions')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: `code ${i}` });
    }
  }

  it('returns submissions sorted newest first', async () => {
    await createSubmissions(3);

    const res = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);

    // newest first (descending _id)
    const ids = res.body.data.map((s: { _id: string }) => s._id);
    const sorted = [...ids].sort().reverse();
    expect(ids).toEqual(sorted);
  });

  it('respects limit parameter', async () => {
    await createSubmissions(5);

    const res = await request(app)
      .get('/api/submissions?limit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.nextCursor).toBeDefined();
  });

  it('paginates with cursor', async () => {
    await createSubmissions(5);

    const page1 = await request(app)
      .get('/api/submissions?limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(page1.body.data).toHaveLength(3);
    expect(page1.body.pagination.nextCursor).toBeDefined();

    const page2 = await request(app)
      .get(`/api/submissions?limit=3&cursor=${page1.body.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${token}`);

    expect(page2.body.data).toHaveLength(2);
    expect(page2.body.pagination.nextCursor).toBeNull();

    // No overlap between pages
    const page1Ids = page1.body.data.map((s: { _id: string }) => s._id);
    const page2Ids = page2.body.data.map((s: { _id: string }) => s._id);
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('returns nextCursor null when no more pages', async () => {
    await createSubmissions(2);

    const res = await request(app)
      .get('/api/submissions?limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.nextCursor).toBeNull();
  });

  it('excludes soft-deleted submissions', async () => {
    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'to delete' });

    await request(app)
      .delete(`/api/submissions/${createRes.body.data.submission._id}`)
      .set('Authorization', `Bearer ${token}`);

    const list = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.data).toHaveLength(0);
  });
});

// ── GET /api/submissions/:id ─────────────────────────────────

describe('GET /api/submissions/:id', () => {
  it('returns submission with its issues', async () => {
    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    const id = createRes.body.data.submission._id;

    const res = await request(app)
      .get(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.submission._id).toBe(id);
    expect(res.body.data.issues).toHaveLength(3);
    expect(res.body.data.issues[0].submissionId).toBe(id);
  });

  it('returns 404 for non-existent id', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/api/submissions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for soft-deleted submission', async () => {
    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    const id = createRes.body.data.submission._id;

    await request(app)
      .delete(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/submissions/:id ──────────────────────────────

describe('DELETE /api/submissions/:id', () => {
  it('soft-deletes (sets deletedAt, does not remove from DB)', async () => {
    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    const id = createRes.body.data.submission._id;

    const res = await request(app)
      .delete(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Still exists in DB with deletedAt set
    const doc = await Submission.findById(id);
    expect(doc).not.toBeNull();
    expect(doc!.deletedAt).not.toBeNull();
  });

  it('returns 404 when deleting already-deleted submission', async () => {
    const createRes = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'const x = 1;' });

    const id = createRes.body.data.submission._id;

    await request(app)
      .delete(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/api/submissions/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent id', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .delete(`/api/submissions/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
