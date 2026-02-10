export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const baseUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

type ApiFetchOptions = {
  token?: string | null;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<T> {
  const url = buildUrl(path);

  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (opts.token) {
    headers.set('Authorization', `Bearer ${opts.token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  const isJson =
    response.headers.get('Content-Type')?.includes('application/json') ?? false;
  const data = text && isJson ? JSON.parse(text) : text;

  if (response.ok) {
    return data as T;
  }

  if (data && typeof data === 'object' && (data as any).error) {
    const err = (data as any).error;
    throw new ApiError(
      err.message ?? 'Request failed',
      response.status,
      err.code,
      err.details,
    );
  }

  throw new ApiError(
    `Request failed with status ${response.status}`,
    response.status,
  );
}

