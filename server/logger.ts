/**
 * Production-Grade Structured Logger with Winston
 * 
 * Features:
 * - Daily log file rotation (7 days retention for general logs, 90 days for errors)
 * - Separate files for different log levels
 * - JSON formatting in production for log aggregators
 * - Human-readable console output in development
 * - Automatic log cleanup and compression
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: any;
}

const isProduction = process.env.NODE_ENV === 'production';
const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (error) {
  console.error('Failed to create logs directory:', error);
}

// Winston log levels mapping (fatal is custom)
const winstonLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const winstonColors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(winstonColors);

// Custom format for development console output
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const emoji = {
      fatal: '💀',
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🐛',
    }[level.replace(/\u001b\[\d+m/g, '')] || '';

    let output = `${emoji} ${timestamp} [${level}] ${message}`;
    
    if (Object.keys(meta).length > 0) {
      const filteredMeta = { ...meta };
      delete filteredMeta.timestamp;
      delete filteredMeta.level;
      delete filteredMeta.message;
      
      if (Object.keys(filteredMeta).length > 0) {
        output += ` | ${JSON.stringify(filteredMeta)}`;
      }
    }
    
    return output;
  })
);

// Custom format for production JSON output
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// JSON format for all file transports (always structured)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  levels: winstonLevels,
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transports: [
    // Console transport - formatted for humans in dev, JSON in prod
    new winston.transports.Console({
      format: isProduction ? productionFormat : developmentFormat,
    }),

    // Combined log file (all levels) - 7 days retention, always JSON
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      format: fileFormat,
    }),

    // Error log file - 90 days retention, always JSON
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '90d',
      format: fileFormat,
    }),

    // Warn log file - 30 days retention, always JSON
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ],
  // Handle exceptions and rejections - always JSON
  exceptionHandlers: [
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      format: fileFormat,
    }),
  ],
});

class Logger {
  private winston: winston.Logger;

  constructor() {
    this.winston = winstonLogger;
  }

  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, context);
  }

  info(message: string, context?: LogContext): void {
    this.winston.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, context);
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.winston.error(message, {
        error: {
          message: contextOrError.message,
          stack: contextOrError.stack,
          name: contextOrError.name,
        },
      });
    } else {
      const meta = { ...contextOrError };
      if (error) {
        meta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name,
        };
      }
      this.winston.error(message, meta);
    }
  }

  fatal(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.winston.log('fatal', message, {
        error: {
          message: contextOrError.message,
          stack: contextOrError.stack,
          name: contextOrError.name,
        },
      });
    } else {
      const meta = { ...contextOrError };
      if (error) {
        meta.error = {
          message: error.message,
          stack: error.stack,
          name: error.name,
        };
      }
      this.winston.log('fatal', message, meta);
    }
  }

  // Convenience methods for common patterns
  http(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info(`${method} ${path} ${statusCode} in ${duration}ms`, {
      ...context,
      method,
      path,
      statusCode,
      duration,
    });
  }

  service(serviceName: string, message: string, context?: LogContext): void {
    this.info(`[${serviceName}] ${message}`, {
      ...context,
      service: serviceName,
    });
  }

  serviceError(serviceName: string, message: string, error?: Error, context?: LogContext): void {
    this.error(`[${serviceName}] ${message}`, {
      ...context,
      service: serviceName,
    }, error);
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
