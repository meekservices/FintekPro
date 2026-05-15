/**
 * Centralized Logger Utility
 * Provides structured logging with severity levels and context tracking.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  userId?: string;
  correlationId?: string;
  executionId?: string;
  feature?: string;
  [key: string]: any;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && LogLevel[envLevel as keyof typeof LogLevel] !== undefined) {
      this.level = LogLevel[envLevel as keyof typeof LogLevel] as unknown as LogLevel;
    }
  }

  private format(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctxString = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${ctxString}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.format('DEBUG', message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.format('INFO', message, context));
    }
  }

  public warn(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.format('WARN', message, context));
    }
  }

  public error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.level <= LogLevel.ERROR) {
      const errContext = error instanceof Error 
        ? { ...context, error: error.message, stack: error.stack }
        : { ...context, error: String(error) };
      console.error(this.format('ERROR', message, errContext));
    }
  }
}

export const logger = new Logger();
