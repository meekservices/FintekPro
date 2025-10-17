/**
 * Production-Grade Structured Logger
 * 
 * Provides consistent, structured logging across the application
 * with support for different log levels, context, and metadata.
 * 
 * In production, logs are JSON-formatted for easy parsing by log aggregators.
 * In development, logs are human-readable for better developer experience.
 */

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
