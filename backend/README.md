# Backend

REST API for the Code Review Assistant. Handles authentication, code submissions, LLM-powered analysis, scoring, points, and achievements.

## Setup

```bash
cp .env.example .env   # then fill in required values
npm install
npm run seed           # seed achievements collection
npm run dev            # starts on port 4000
```

### Required environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Secret for access token signing |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing |

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `NODE_ENV` | `development` | `development`, `production`, or `test` |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LLM_PROVIDER` | `fake` | `claude`, `gemini`, or `fake` |
| `ANTHROPIC_API_KEY` | — | Required when `LLM_PROVIDER=claude` |
| `GEMINI_API_KEY` | — | Required when `LLM_PROVIDER=gemini` |

The `fake` LLM provider returns deterministic mock responses and requires no API key — useful for local development and testing.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Watch-mode dev server (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server (`node dist/server.js`) |
| `npm test` | Run Jest test suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run seed` | Seed achievements into the database |
| `npm run eval` | Run LLM evaluation suite against test fixtures |

## API endpoints

All responses follow the shape `{ ok: boolean, data?: T, error?: { code: string, message: string } }`.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server uptime check |

### Authentication

| Method | Path | Rate limit | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | 5 / 15 min | Create account (`email`, `password`, `displayName`) |
| `POST` | `/api/auth/login` | 5 / 15 min | Log in, returns access token + refresh cookie |
| `POST` | `/api/auth/refresh` | — | Exchange refresh cookie for new access token |
| `POST` | `/api/auth/logout` | — | Revoke refresh token, clear cookie |
| `GET` | `/api/auth/me` | — | Get authenticated user profile |

### Submissions (requires `Authorization: Bearer <token>`)

| Method | Path | Rate limit | Description |
|---|---|---|---|
| `POST` | `/api/submissions` | 20 / hour | Submit code for LLM review (`code`, `language`) |
| `GET` | `/api/submissions` | — | List submissions (cursor pagination: `limit`, `cursor`) |
| `GET` | `/api/submissions/stats` | — | Category averages and top recurring issues |
| `GET` | `/api/submissions/:id` | — | Single submission with issues |
| `DELETE` | `/api/submissions/:id` | — | Soft-delete |

### Points & achievements (requires auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/points/me` | Total points, current level, streak, recent ledger |
| `GET` | `/api/achievements` | All achievements with unlock status and progress |

## Architecture

```
src/
├── config/env.ts          Zod-validated environment config
├── db/
│   ├── connect.ts         MongoDB connection with retry logic
│   └── seed.ts            Achievement seed script
├── middleware/
│   ├── errorHandler.ts    Central error handler (AppError, ZodError)
│   ├── requireAuth.ts     JWT verification, attaches req.user
│   └── requireRole.ts     Role-based access control
├── models/                Mongoose schemas
│   ├── User.ts
│   ├── Submission.ts
│   ├── Issue.ts
│   ├── Achievement.ts
│   ├── UserAchievement.ts
│   ├── PointsLedger.ts
│   └── RefreshToken.ts
├── routes/                Express routers
│   ├── auth.ts
│   ├── submissions.ts
│   ├── points.ts
│   ├── achievements.ts
│   └── health.ts
├── services/
│   ├── llm/
│   │   ├── ClaudeClient.ts    Anthropic SDK integration
│   │   ├── GeminiClient.ts    Google GenAI SDK integration
│   │   ├── FakeLLMClient.ts   Mock client for dev/test
│   │   ├── factory.ts         LLM client factory
│   │   ├── types.ts           LLMClient interface
│   │   └── prompts/review.ts  System prompt and few-shot examples
│   ├── achievements/
│   │   ├── engine.ts          Evaluates achievements after submissions
│   │   └── checkers.ts        Strategy pattern: one checker per achievement
│   ├── auth.ts                Registration, login, token refresh/revoke
│   ├── points.ts              Point awarding, levels, streak calculation
│   ├── scoring.ts             Deterministic score adjustments
│   └── submissions.ts         Submission lifecycle and stats
├── app.ts                 Express app factory
└── server.ts              Entry point (connect DB, start listening)
```

## Data models

**User** — email, passwordHash, displayName, role, totalPoints

**Submission** — userId, code, language, status (`analysing` / `complete` / `failed`), scoreOverall, scoreBreakdown (style, bestPractices, logic, readability), summary, deletedAt (soft delete)

**Issue** — submissionId, severity (`info` / `warning` / `error`), category (`style` / `best_practice` / `logic` / `readability`), lineNumber, message, suggestion

**PointsLedger** — userId, submissionId, amount, reason

**Achievement** — code, name, description, criteria

**UserAchievement** — userId, achievementId, unlockedAt

**RefreshToken** — userId, tokenHash (SHA-256), expiresAt, revokedAt

## LLM integration

The `LLMClient` interface exposes a single method:

```typescript
analyseCode(code: string, language: string): Promise<AnalysisResult>
```

The Claude and Gemini clients send a system prompt with two few-shot examples, validate the response with Zod, and retry once if the JSON is malformed. Code is capped at 10 000 characters with a 30-second timeout.

After the LLM returns a result, `applyScoring` adjusts the overall score deterministically based on issue severities, then `awardSubmissionPoints` and `evaluateAchievements` run as fire-and-forget side effects.

## Testing

Tests use Jest with `mongodb-memory-server` for an in-memory database:

```bash
npm test
```

The test environment uses `NODE_ENV=test`, the `fake` LLM provider, and relaxed rate limits.
