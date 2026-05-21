import type { ApiResponse } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/* ------------------------------------------------------------------ */
/*  In-memory access token — never touches localStorage or cookies    */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/* ------------------------------------------------------------------ */
/*  Low-level fetch that attaches the bearer token + sends cookies    */
/* ------------------------------------------------------------------ */

async function authFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    return {
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Is the backend running?' },
    };
  }

  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return {
      ok: false,
      error: { code: 'PARSE_ERROR', message: `Unexpected response (HTTP ${res.status})` },
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Refresh the access token using the httpOnly cookie                */
/* ------------------------------------------------------------------ */

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        setAccessToken(null);
        return false;
      }

      const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (body.ok) {
        setAccessToken(body.data.accessToken);
        return true;
      }
      setAccessToken(null);
      return false;
    } catch {
      setAccessToken(null);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ------------------------------------------------------------------ */
/*  Public fetch wrapper: auto-refreshes on 401, retries once         */
/* ------------------------------------------------------------------ */

export async function apiWithAuth<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const result = await authFetch<T>(path, options);

  // If we got a 401 and have (or had) a token, try refreshing
  if (!result.ok && result.error.code.startsWith('AUTH_TOKEN_')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return authFetch<T>(path, options);
    }

    // Refresh failed — session is dead. Clear cookie so middleware
    // will gate protected routes on next navigation.
    if (typeof document !== 'undefined') {
      document.cookie = 'logged_in=; path=/; max-age=0';
    }
  }

  return result;
}
