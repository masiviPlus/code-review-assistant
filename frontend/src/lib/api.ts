const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch {
    return {
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Is the backend running?' },
    };
  }

  try {
    const body: ApiResponse<T> = await res.json();
    return body;
  } catch {
    return {
      ok: false,
      error: { code: 'PARSE_ERROR', message: `Unexpected response (HTTP ${res.status})` },
    };
  }
}
