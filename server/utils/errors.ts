/**
 * Error Taxonomy and Utilities
 * Provides typed error classes for consistent error handling across the application
 */

export interface ErrorContext {
  [key: string]: any;
}

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly userMessage: string;
  public readonly isRetryable: boolean;
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    status: number = 500,
    userMessage?: string,
    isRetryable: boolean = false,
    context?: ErrorContext
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.userMessage = userMessage || this.getDefaultUserMessage();
    this.isRetryable = isRetryable;
    this.context = context;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  protected getDefaultUserMessage(): string {
    return 'An unexpected error occurred. Please try again.';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      userMessage: this.userMessage,
      status: this.status,
      isRetryable: this.isRetryable,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

/**
 * Validation error (400)
 * Used for invalid input data
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, undefined, false, context);
  }

  protected getDefaultUserMessage(): string {
    return 'Please check your input and try again.';
  }
}

/**
 * Authentication error (401)
 * Used for authentication failures
 */
export class AuthError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 401, undefined, false, context);
  }

  protected getDefaultUserMessage(): string {
    return 'Please sign in again to continue.';
  }
}

/**
 * Authorization error (403)
 * Used for permission/access control failures
 */
export class ForbiddenError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 403, undefined, false, context);
  }

  protected getDefaultUserMessage(): string {
    return 'You do not have permission to perform this action.';
  }
}

/**
 * Not found error (404)
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 404, undefined, false, context);
  }

  protected getDefaultUserMessage(): string {
    return 'The requested resource was not found.';
  }
}

/**
 * Rate limit error (429)
 * Used when rate limits are exceeded
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number, context?: ErrorContext) {
    super(message, 429, undefined, true, context);
    this.retryAfter = retryAfter;
  }

  protected getDefaultUserMessage(): string {
    const retryMsg = this.retryAfter
      ? ` Please try again in ${Math.ceil(this.retryAfter / 60)} minute(s).`
      : ' Please try again in a few minutes.';
    return `Too many requests.${retryMsg}`;
  }
}

/**
 * External service error (503)
 * Used for third-party API failures
 */
export class ExternalServiceError extends AppError {
  public readonly serviceName: string;
  public readonly originalError?: Error;

  constructor(
    serviceName: string,
    message: string,
    originalError?: Error,
    isRetryable: boolean = true,
    context?: ErrorContext
  ) {
    super(message, 503, undefined, isRetryable, context);
    this.serviceName = serviceName;
    this.originalError = originalError;
  }

  protected getDefaultUserMessage(): string {
    return `The ${this.serviceName} service is temporarily unavailable. We're working to restore it. Please try again shortly.`;
  }
}

/**
 * Circuit breaker open error (503)
 * Used when circuit breaker is open
 */
export class CircuitOpenError extends AppError {
  public readonly serviceName: string;
  public readonly openUntil?: Date;

  constructor(serviceName: string, openUntil?: Date, context?: ErrorContext) {
    super(
      `Circuit breaker is open for ${serviceName}`,
      503,
      undefined,
      false,
      context
    );
    this.serviceName = serviceName;
    this.openUntil = openUntil;
  }

  protected getDefaultUserMessage(): string {
    const retryMsg = this.openUntil
      ? ` Please try again after ${this.openUntil.toLocaleTimeString()}.`
      : ' Please try again shortly.';
    return `The ${this.serviceName} service is temporarily unavailable.${retryMsg}`;
  }
}

/**
 * Timeout error (504)
 * Used when operations exceed time limits
 */
export class TimeoutError extends AppError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, context?: ErrorContext) {
    super(message, 504, undefined, true, context);
    this.timeoutMs = timeoutMs;
  }

  protected getDefaultUserMessage(): string {
    return 'The operation took too long to complete. Please try again.';
  }
}

/**
 * Conflict error (409)
 * Used for resource conflicts (e.g., duplicate entries)
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 409, undefined, false, context);
  }

  protected getDefaultUserMessage(): string {
    return 'This operation conflicts with existing data. Please review and try again.';
  }
}

/**
 * Database error (500)
 * Used for database operation failures
 */
export class DatabaseError extends AppError {
  public readonly operation: string;

  constructor(operation: string, message: string, context?: ErrorContext) {
    super(message, 500, undefined, true, context);
    this.operation = operation;
  }

  protected getDefaultUserMessage(): string {
    return 'A database error occurred. Please try again.';
  }
}

/**
 * Normalize any error into an AppError
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      500,
      'An unexpected error occurred. Please try again.',
      false,
      { originalError: error.name, stack: error.stack }
    );
  }

  return new AppError(
    String(error),
    500,
    'An unexpected error occurred. Please try again.',
    false,
    { originalValue: error }
  );
}

/**
 * User-friendly error message mapping
 */
export const ERROR_MESSAGES: Record<number, string> = {
  400: 'Please double-check your input.',
  401: 'Please sign in again.',
  403: 'You do not have permission to access this resource.',
  404: 'The requested resource was not found.',
  409: 'This operation conflicts with existing data.',
  429: 'Too many attempts. Please try again in a few minutes.',
  500: 'An unexpected error occurred. Our team has been notified.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The request took too long to complete. Please try again.',
};

/**
 * Get user-friendly message for status code
 */
export function getUserMessage(status: number, customMessage?: string): string {
  return customMessage || ERROR_MESSAGES[status] || ERROR_MESSAGES[500];
}
