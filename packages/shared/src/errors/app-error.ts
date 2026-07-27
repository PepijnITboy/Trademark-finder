import { createId } from '../ids';
import { ERROR_CATEGORIES, ERROR_CATEGORY_HTTP_STATUS, type ErrorCategory } from './error-categories';

export interface AppErrorOptions {
  /** Stable machine-readable error code, e.g. `WATCHED_TRADEMARK_NOT_FOUND`. */
  code: string;
  /** Human-readable Dutch message safe to show to end users. */
  messageNl: string;
  category?: ErrorCategory;
  /** Overrides the HTTP status implied by `category`. */
  httpStatus?: number;
  cause?: unknown;
  details?: Record<string, unknown>;
  /** Overrides the auto-generated support reference code. */
  referenceCode?: string;
}

/**
 * Base application error. Every domain/service error thrown across the
 * Merkwacht API and worker should extend or construct this class so that
 * error handling middleware can consistently log and respond with a Dutch
 * message plus a traceable reference code.
 */
export class AppError extends Error {
  readonly code: string;
  readonly messageNl: string;
  readonly referenceCode: string;
  readonly category: ErrorCategory;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(options: AppErrorOptions) {
    super(options.messageNl, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = options.code;
    this.messageNl = options.messageNl;
    this.category = options.category ?? ERROR_CATEGORIES.INTERNAL;
    this.httpStatus = options.httpStatus ?? ERROR_CATEGORY_HTTP_STATUS[this.category];
    this.referenceCode = options.referenceCode ?? `ERR-${createId().slice(0, 8).toUpperCase()}`;
    this.details = options.details;
  }

  /** Wraps an unknown thrown value, passing it through untouched if already an AppError. */
  static fromUnknown(error: unknown, fallback: Omit<AppErrorOptions, 'cause'>): AppError {
    if (error instanceof AppError) {
      return error;
    }
    return new AppError({ ...fallback, cause: error });
  }

  toJSON(): { code: string; messageNl: string; referenceCode: string; category: ErrorCategory } {
    return {
      code: this.code,
      messageNl: this.messageNl,
      referenceCode: this.referenceCode,
      category: this.category,
    };
  }
}
