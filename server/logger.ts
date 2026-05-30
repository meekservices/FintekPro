/**
 * Production-Grade Structured Logger
 *
 * Provides consistent, structured logging across the application
 * with support for different log levels, context, and metadata.
 *
 * In production, logs are JSON-formatted for easy parsing by log aggregators.
 * In development, logs are human-readable for better developer experience.
 *
 * PII GUARDRAIL (production only): console.* is overridden to mask
 * PAN, Aadhaar, Indian phone numbers, and email addresses before any
 * string reaches Cloud Logging.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PII Scrubber — production console override
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex patterns for sensitive Indian financial data.
 * Applied in order — more specific patterns first.
 */
const PII_PATTERNS: [RegExp, string][] = [
  // PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,                                '[PAN-REDACTED]'],
  // Aadhaar: exactly 12 consecutive digits (not part of a longer number)
  [/(?<!\d)\d{12}(?!\d)/g,                                      '[AADHAAR-REDACTED]'],
  // Indian mobile: optional +91/91/0 prefix, then 10-digit starting 6-9
  [/(?:\+91|91|0)?[6-9]\d{9}\b/g,                              '[PHONE-REDACTED]'],
  // Email address
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,      '[EMAIL-REDACTED]'],
  // IFSC code (4 letters + 0 + 6 alphanumeric)
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g,                               '[IFSC-REDACTED]'],
  // Bank account-like numbers: 9-18 consecutive digits
  [/(?<![.\d])\d{9,18}(?![.\d])/g,                            '[ACCOUNT-REDACTED]'],
];

function scrubPii(raw: string): string {
  let out = raw;
  for (const [pattern, replacement] of PII_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error)   return `${arg.name}: ${arg.message}`;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

/**
 * Overrides console.log/warn/error/info/debug in production to scrub PII
 * before any string reaches Cloud Logging / stdout.
 *
 * Call order: caller → scrubPii → original console method.
 * No-op in development.
 *
 * @purpose  Prevent PAN, Aadhaar, phone, email from leaking into Cloud Logging
 * @inputs   NODE_ENV
 * @outputs  Mutates global console (production only)
 * @edge     Large objects are JSON.stringify'd — circular refs are caught
 */
function installPiiScrubber(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const methods = ['log', 'warn', 'error', 'info', 'debug'] as const;

  for (const method of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const scrubbed = args.map((a) => scrubPii(serializeArg(a)));
      original(...scrubbed);
    };
  }
}

// Install immediately at module load (before any other logger usage)
installPiiScrubber();

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.isProduction ? 'info' : 'debug');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatLog(entry: LogEntry): string {
    if (this.isProduction) {
      // JSON format for production (easy to parse by log aggregators)
      return JSON.stringify(entry);
    } else {
      // Human-readable format for development
      const emoji = {
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        fatal: '💀',
      }[entry.level];

      let output = `${emoji} [${entry.level.toUpperCase()}] ${entry.message}`;
      
      if (entry.context && Object.keys(entry.context).length > 0) {
        output += ` | ${JSON.stringify(entry.context)}`;
      }
      
      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack}`;
        }
      }
      
      return output;
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    const formatted = this.formatLog(entry);

    // Output to appropriate stream
    if (level === 'error' || level === 'fatal') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.log('error', message, undefined, contextOrError);
    } else {
      this.log('error', message, contextOrError, error);
    }
  }

  fatal(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.log('fatal', message, undefined, contextOrError);
    } else {
      this.log('fatal', message, contextOrError, error);
    }
  }

  // Convenience methods for common patterns
  http(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info(`${method} ${path} ${statusCode} in ${duration}ms`, context);
  }

  service(serviceName: string, message: string, context?: LogContext): void {
    this.info(`[${serviceName}] ${message}`, context);
  }

  serviceError(serviceName: string, message: string, error?: Error, context?: LogContext): void {
    this.error(`[${serviceName}] ${message}`, context, error);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export the scrubber for testing
export { scrubPii };

// Export convenience functions for backward compatibility
export const log = {
  debug: (msg: string, ctx?: LogContext) => logger.debug(msg, ctx),
  info: (msg: string, ctx?: LogContext) => logger.info(msg, ctx),
  warn: (msg: string, ctx?: LogContext) => logger.warn(msg, ctx),
  error: (msg: string, errOrCtx?: Error | LogContext, err?: Error) => logger.error(msg, errOrCtx, err),
  fatal: (msg: string, errOrCtx?: Error | LogContext, err?: Error) => logger.fatal(msg, errOrCtx, err),
  http: (method: string, path: string, status: number, duration: number, ctx?: LogContext) => 
    logger.http(method, path, status, duration, ctx),
  service: (name: string, msg: string, ctx?: LogContext) => logger.service(name, msg, ctx),
  serviceError: (name: string, msg: string, err?: Error, ctx?: LogContext) => 
    logger.serviceError(name, msg, err, ctx),
};
