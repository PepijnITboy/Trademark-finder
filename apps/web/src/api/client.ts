/**
 * Thin fetch wrapper for the Merkwacht API. Centralizes the base URL,
 * JSON (de)serialization, and Dutch-first error surfacing so query/mutation
 * composables never touch `fetch` directly.
 */

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Shape of the JSON error body every API route returns via its Fastify error handler. */
export interface ApiErrorBody {
  readonly code: string;
  readonly messageNl: string;
  readonly referenceCode: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly referenceCode: string;
  readonly status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.messageNl);
    this.name = 'ApiError';
    this.code = body.code;
    this.referenceCode = body.referenceCode;
    this.status = status;
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), `${API_BASE_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Performs a JSON request against the API and returns the parsed body, typed as `T`. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorBody = (await response.json()) as ApiErrorBody;
      throw new ApiError(response.status, errorBody);
    }
    throw new ApiError(response.status, {
      code: 'UNKNOWN_ERROR',
      messageNl: 'Er is een onverwachte fout opgetreden bij het communiceren met de server.',
      referenceCode: String(response.status),
    });
  }

  if (response.status === 204) return undefined as T;
  return isJson ? ((await response.json()) as T) : ((await response.text()) as unknown as T);
}

/** Builds the absolute URL for a downloadable/openable API resource (e.g. exports), without fetching it. */
export function apiResourceUrl(path: string, query?: RequestOptions['query']): string {
  return buildUrl(path, query);
}
