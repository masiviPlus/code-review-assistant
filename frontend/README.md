# Frontend

Next.js 14 App Router frontend for the Code Review Assistant. Provides a code editor for submissions, a review panel with scored feedback, a dashboard with analytics, and an achievements page.

## Setup

```bash
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev                        # starts on port 3000
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |

Variables prefixed `NEXT_PUBLIC_` are exposed to the browser. Everything else stays server-side.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server with hot reload (port 3000) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run e2e` | Run Playwright end-to-end tests |
| `npm run e2e:ui` | Run E2E tests with interactive UI |

## Pages

| Route | Description |
|---|---|
| `/` | Landing page (public) |
| `/login` | Log in (redirects to dashboard if authenticated) |
| `/register` | Create account (redirects to dashboard if authenticated) |
| `/dashboard` | Submission history, score trend, activity heatmap, category averages, top issues, achievements |
| `/submit` | Monaco code editor with language selector and sample snippets; submit for LLM review |
| `/submissions/:id` | Read-only editor + review panel with score, breakdown, and issues |
| `/achievements` | All achievements with unlock status, progress bars, and descriptions |

Protected routes (`/dashboard`, `/submit`, `/submissions/*`, `/achievements`) redirect to `/login` when unauthenticated via Next.js middleware.

## Architecture

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx         Centered auth form layout
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx
│   ├── submit/page.tsx
│   ├── submissions/[id]/page.tsx
│   ├── achievements/page.tsx
│   ├── layout.tsx             Root layout (providers, nav, fonts)
│   ├── page.tsx               Landing page
│   └── globals.css            Tailwind base, theme variables
├── components/
│   ├── nav.tsx                Navigation bar with level indicator
│   ├── review-panel.tsx       Score + issues sidebar
│   ├── activity-heatmap.tsx   90-day submission calendar
│   ├── category-breakdown.tsx Bar chart of category averages
│   ├── top-issues-panel.tsx   Most recurring issues list
│   ├── achievements-card.tsx  Dashboard achievements widget
│   └── ui/                    Primitives (button, card, input, progress bar)
├── contexts/
│   ├── auth-context.tsx       Auth provider, token management, user state
│   └── theme-context.tsx      Dark/light theme provider
├── lib/
│   ├── api.ts                 Typed API client with auth headers
│   ├── auth.ts                Token storage, refresh logic, fetch wrapper
│   ├── types.ts               Shared TypeScript types
│   ├── review-utils.ts        Issue grouping and formatting
│   ├── score-utils.ts         Score color helpers
│   ├── submission-utils.ts    Submission data transforms
│   ├── use-monaco-theme.ts    Monaco editor theme hook
│   └── utils.ts               General utilities
└── middleware.ts              Route protection (checks session cookie)
```

## Authentication

- **Access token**: stored in memory (never `localStorage`), sent as `Authorization: Bearer` header.
- **Refresh token**: httpOnly cookie, automatically sent by the browser.
- **Session flag**: a `logged_in` cookie visible to Next.js middleware for route gating without exposing the actual token.
- On 401, the client silently refreshes the access token and retries the request once. Concurrent refresh calls are deduplicated.

## Theming

Dark mode uses a `data-theme` attribute on `<html>`. An inline script in the root layout reads `localStorage` (falling back to OS preference) before React hydrates, preventing a flash of wrong theme. Toggle is available in the navigation bar.

Color palette uses HSL CSS variables — one neutral background, one ink for text, one blue accent. Typography is Inter for UI and JetBrains Mono for code.

## Key dependencies

| Package | Purpose |
|---|---|
| Next.js 14 | React framework (App Router) |
| Tailwind CSS | Utility-first styling |
| Monaco Editor | Code editor (same as VS Code) |
| React Hook Form + Zod | Form state and validation |
| Recharts | Score trend and category bar charts |
| Lucide React | Icons |
| Radix UI | Headless UI primitives |
| Playwright | End-to-end testing |

## E2E tests

Playwright tests live in `e2e/` and run against the full stack:

```bash
npm run e2e          # headless
npm run e2e:ui       # interactive UI mode
```

The CI pipeline starts both backend and frontend, then runs E2E tests with Chromium.
