import { randomUUID } from 'node:crypto';

/**
 * Generates a random UUID v4 suitable for entity primary keys.
 */
export function createId(): string {
  return randomUUID();
}

/**
 * Generates a correlation id used to trace a single request/job across
 * services (API, worker) and through structured logs.
 */
export function createCorrelationId(): string {
  return `cor_${randomUUID()}`;
}
