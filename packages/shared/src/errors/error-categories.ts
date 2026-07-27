/**
 * Canonical error categories used across the Merkwacht platform. These map
 * 1:1 to default HTTP status codes and drive how errors are logged and
 * surfaced to end users.
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  CONFIGURATION: 'CONFIGURATION',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[keyof typeof ERROR_CATEGORIES];

export const ERROR_CATEGORY_HTTP_STATUS: Record<ErrorCategory, number> = {
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  EXTERNAL_SERVICE: 502,
  CONFIGURATION: 500,
  INTERNAL: 500,
};
