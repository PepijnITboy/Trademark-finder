export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  /** Name of the process/service emitting logs, e.g. "api" or "worker". */
  service: string;
  level?: LogLevel;
  correlationId?: string | undefined;
  bindings?: Record<string, unknown> | undefined;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Returns a new logger with additional bound fields (e.g. correlationId). */
  child(bindings: Record<string, unknown>): Logger;
}

interface ResolvedLoggerOptions {
  service: string;
  level: LogLevel;
  correlationId: string | undefined;
  bindings: Record<string, unknown> | undefined;
}

function write(level: LogLevel, options: ResolvedLoggerOptions, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[options.level]) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: options.service,
    correlationId: options.correlationId,
    message,
    ...options.bindings,
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Creates a structured JSON logger. Every log line is a single JSON object
 * with `timestamp`, `level`, `service`, `correlationId`, and `message`
 * fields, which makes it easy to ingest into any log aggregator.
 */
export function createLogger(options: LoggerOptions): Logger {
  const resolved: ResolvedLoggerOptions = {
    service: options.service,
    level: options.level ?? 'info',
    correlationId: options.correlationId,
    bindings: options.bindings,
  };

  return {
    debug: (message, meta) => write('debug', resolved, message, meta),
    info: (message, meta) => write('info', resolved, message, meta),
    warn: (message, meta) => write('warn', resolved, message, meta),
    error: (message, meta) => write('error', resolved, message, meta),
    child: (bindings) =>
      createLogger({
        service: resolved.service,
        level: resolved.level,
        correlationId: resolved.correlationId,
        bindings: { ...resolved.bindings, ...bindings },
      }),
  };
}
