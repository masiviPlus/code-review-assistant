import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User';
import { Submission } from '../src/models/Submission';
import { Issue } from '../src/models/Issue';
import { Achievement } from '../src/models/Achievement';
import { UserAchievement } from '../src/models/UserAchievement';
import { PointsLedger } from '../src/models/PointsLedger';
import { RefreshToken } from '../src/models/RefreshToken';
import { seedAchievements } from '../src/db/seed';

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

// ── User ──────────────────────────────────────────────────────

describe('User', () => {
  const validUser = {
    email: 'test@example.com',
    passwordHash: 'hashed123',
    displayName: 'Test User',
  };

  it('creates a user with defaults', async () => {
    const user = await User.create(validUser);
    expect(user.role).toBe('user');
    expect(user.totalPoints).toBe(0);
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
  });

  it('rejects missing required fields', async () => {
    await expect(User.create({})).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects invalid role', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid enum value
      User.create({ ...validUser, role: 'superadmin' }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('enforces unique email', async () => {
    await User.create(validUser);
    await expect(User.create(validUser)).rejects.toThrow();
  });
});

// ── Submission ────────────────────────────────────────────────

describe('Submission', () => {
  const userId = new mongoose.Types.ObjectId();

  it('creates a submission with defaults', async () => {
    const sub = await Submission.create({ userId, code: 'const x = 1;' });
    expect(sub.status).toBe('analysing');
    expect(sub.language).toBe('javascript');
    expect(sub.deletedAt).toBeNull();
  });

  it('rejects missing code', async () => {
    await expect(Submission.create({ userId })).rejects.toThrow(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects invalid status', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid enum value
      Submission.create({ userId, code: 'x', status: 'unknown' }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('accepts valid scoreBreakdown', async () => {
    const sub = await Submission.create({
      userId,
      code: 'x',
      scoreBreakdown: {
        style: 85,
        bestPractices: 90,
        logic: 70,
        readability: 95,
      },
    });
    expect(sub.scoreBreakdown?.style).toBe(85);
  });

  it('rejects scoreBreakdown values out of range', async () => {
    await expect(
      Submission.create({
        userId,
        code: 'x',
        scoreBreakdown: { style: 150 },
      }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

// ── Issue ─────────────────────────────────────────────────────

describe('Issue', () => {
  const submissionId = new mongoose.Types.ObjectId();

  it('creates an issue', async () => {
    const issue = await Issue.create({
      submissionId,
      severity: 'warning',
      category: 'style',
      lineNumber: 10,
      message: 'Use const instead of let',
    });
    expect(issue.severity).toBe('warning');
  });

  it('rejects invalid severity', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid enum value
      Issue.create({ submissionId, severity: 'critical', category: 'style' }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects invalid category', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid enum value
      Issue.create({ submissionId, severity: 'info', category: 'perf' }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

// ── Achievement ───────────────────────────────────────────────

describe('Achievement', () => {
  it('creates an achievement', async () => {
    const a = await Achievement.create({ code: 'test_ach', name: 'Test' });
    expect(a.code).toBe('test_ach');
  });

  it('enforces unique code', async () => {
    await Achievement.create({ code: 'dup', name: 'First' });
    await expect(
      Achievement.create({ code: 'dup', name: 'Second' }),
    ).rejects.toThrow();
  });
});

// ── UserAchievement ──────────────────────────────────────────

describe('UserAchievement', () => {
  it('creates a user achievement', async () => {
    const ua = await UserAchievement.create({
      userId: new mongoose.Types.ObjectId(),
      achievementId: new mongoose.Types.ObjectId(),
    });
    expect(ua.unlockedAt).toBeDefined();
  });

  it('prevents duplicate userId + achievementId', async () => {
    const userId = new mongoose.Types.ObjectId();
    const achievementId = new mongoose.Types.ObjectId();
    await UserAchievement.create({ userId, achievementId });
    await expect(
      UserAchievement.create({ userId, achievementId }),
    ).rejects.toThrow();
  });

  it('allows same user with different achievements', async () => {
    const userId = new mongoose.Types.ObjectId();
    await UserAchievement.create({
      userId,
      achievementId: new mongoose.Types.ObjectId(),
    });
    await UserAchievement.create({
      userId,
      achievementId: new mongoose.Types.ObjectId(),
    });
    const count = await UserAchievement.countDocuments({ userId });
    expect(count).toBe(2);
  });
});

// ── PointsLedger ─────────────────────────────────────────────

describe('PointsLedger', () => {
  it('creates a ledger entry with createdAt but no updatedAt', async () => {
    const entry = await PointsLedger.create({
      userId: new mongoose.Types.ObjectId(),
      amount: 10,
      reason: 'submission',
    });
    expect(entry.createdAt).toBeDefined();
    // updatedAt should not be set (timestamps config)
    expect((entry as unknown as Record<string, unknown>)['updatedAt']).toBeUndefined();
  });

  it('rejects missing amount', async () => {
    await expect(
      PointsLedger.create({
        userId: new mongoose.Types.ObjectId(),
        reason: 'test',
      }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

// ── RefreshToken ─────────────────────────────────────────────

describe('RefreshToken', () => {
  it('creates a token with timestamps', async () => {
    const token = await RefreshToken.create({
      userId: new mongoose.Types.ObjectId(),
      tokenHash: 'abc123',
      expiresAt: new Date(Date.now() + 86400000),
    });
    expect(token.createdAt).toBeDefined();
    expect(token.revokedAt).toBeNull();
  });

  it('enforces unique tokenHash', async () => {
    const base = {
      userId: new mongoose.Types.ObjectId(),
      tokenHash: 'same_hash',
      expiresAt: new Date(),
    };
    await RefreshToken.create(base);
    await expect(RefreshToken.create(base)).rejects.toThrow();
  });
});

// ── Seed ──────────────────────────────────────────────────────

describe('seedAchievements', () => {
  it('seeds 8 achievements', async () => {
    await seedAchievements();
    const count = await Achievement.countDocuments();
    expect(count).toBe(8);
  });

  it('is idempotent — running twice keeps count at 8', async () => {
    await seedAchievements();
    await seedAchievements();
    const count = await Achievement.countDocuments();
    expect(count).toBe(8);
  });

  it('seeds all expected codes', async () => {
    await seedAchievements();
    const codes = (await Achievement.find().lean()).map((a) => a.code).sort();
    expect(codes).toEqual([
      'bug_hunter',
      'consistent',
      'first_steps',
      'marathoner',
      'perfectionist',
      'polyglot',
      'reformed',
      'style_master',
    ]);
  });
});
