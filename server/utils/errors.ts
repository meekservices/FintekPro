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

// ==================== UNLISTED MARKETPLACE ERRORS ====================

/**
 * KYC Eligibility Error (403)
 * Used when user doesn't meet KYC requirements for unlisted trading
 */
export class KycEligibilityError extends AppError {
  public readonly requiredTier: string;
  public readonly currentTier: string;

  constructor(
    requiredTier: string,
    currentTier: string,
    context?: ErrorContext
  ) {
    super(
      `KYC tier ${requiredTier} required, user has ${currentTier}`,
      403,
      undefined,
      false,
      context
    );
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
  }

  protected getDefaultUserMessage(): string {
    const tierMap: Record<string, string> = {
      'basic': 'Basic KYC',
      'enhanced': 'Enhanced KYC',
      'accredited': 'Accredited Investor status'
    };
    return `You need ${tierMap[this.requiredTier] || this.requiredTier} to access this feature. Complete your KYC verification to continue.`;
  }
}

/**
 * Unlisted Trading Error (400)
 * Used for unlisted marketplace trading-related issues
 */
export class UnlistedTradingError extends AppError {
  public readonly errorCode: UnlistedErrorCode;

  constructor(
    errorCode: UnlistedErrorCode,
    message: string,
    context?: ErrorContext
  ) {
    super(message, 400, undefined, false, context);
    this.errorCode = errorCode;
  }

  protected getDefaultUserMessage(): string {
    return UNLISTED_ERROR_MESSAGES[this.errorCode] || 'Unable to complete this trading action. Please try again.';
  }
}

export type UnlistedErrorCode =
  | 'COMPANY_SUSPENDED'
  | 'INSUFFICIENT_QUANTITY'
  | 'PRICE_MISMATCH'
  | 'LISTING_EXPIRED'
  | 'LISTING_NOT_FOUND'
  | 'DEAL_ALREADY_MATCHED'
  | 'DEAL_CANCELLED'
  | 'SELF_TRADING_BLOCKED'
  | 'COMPLIANCE_BLOCK'
  | 'HIGH_RISK_COMPANY'
  | 'CART_LIMIT_EXCEEDED'
  | 'DUPLICATE_CART_ITEM'
  | 'INVALID_PRICE_RANGE'
  | 'MIN_QUANTITY_REQUIRED'
  | 'MAX_QUANTITY_EXCEEDED';

export const UNLISTED_ERROR_MESSAGES: Record<UnlistedErrorCode, string> = {
  COMPANY_SUSPENDED: 'Trading is temporarily suspended for this company. Check back later or contact support.',
  INSUFFICIENT_QUANTITY: 'Not enough shares available to complete your order. Try reducing the quantity.',
  PRICE_MISMATCH: 'The price has changed since you started. Please refresh and try again.',
  LISTING_EXPIRED: 'This listing has expired. Please browse other available listings.',
  LISTING_NOT_FOUND: 'This listing is no longer available. It may have been sold or cancelled.',
  DEAL_ALREADY_MATCHED: 'This deal has already been matched with another party.',
  DEAL_CANCELLED: 'This deal has been cancelled and cannot be modified.',
  SELF_TRADING_BLOCKED: 'You cannot trade with yourself. Use a different account for selling.',
  COMPLIANCE_BLOCK: 'This transaction requires additional verification. Please contact support.',
  HIGH_RISK_COMPANY: 'This company has elevated risk factors. Please review the risk disclosures.',
  CART_LIMIT_EXCEEDED: 'You can add up to 10 companies to your cart at once.',
  DUPLICATE_CART_ITEM: 'This company is already in your cart. Update the existing item instead.',
  INVALID_PRICE_RANGE: 'Your price is outside the acceptable range. Check current market prices.',
  MIN_QUANTITY_REQUIRED: 'Minimum order quantity is 1 share.',
  MAX_QUANTITY_EXCEEDED: 'Order quantity exceeds the maximum allowed limit.',
};

/**
 * Escrow Error (400/500)
 * Used for payment and escrow-related issues
 */
export class EscrowError extends AppError {
  public readonly errorCode: EscrowErrorCode;

  constructor(
    errorCode: EscrowErrorCode,
    message: string,
    isRetryable: boolean = false,
    context?: ErrorContext
  ) {
    const status = ['GATEWAY_ERROR', 'TIMEOUT', 'PROCESSING_ERROR'].includes(errorCode) ? 503 : 400;
    super(message, status, undefined, isRetryable, context);
    this.errorCode = errorCode;
  }

  protected getDefaultUserMessage(): string {
    return ESCROW_ERROR_MESSAGES[this.errorCode] || 'Payment processing issue. Please try again or use a different payment method.';
  }
}

export type EscrowErrorCode =
  | 'PAYMENT_FAILED'
  | 'INSUFFICIENT_FUNDS'
  | 'ESCROW_NOT_FOUND'
  | 'ESCROW_ALREADY_RELEASED'
  | 'ESCROW_EXPIRED'
  | 'TRANSFER_NOT_CONFIRMED'
  | 'GATEWAY_ERROR'
  | 'TIMEOUT'
  | 'PROCESSING_ERROR'
  | 'REFUND_FAILED'
  | 'INVALID_AMOUNT';

export const ESCROW_ERROR_MESSAGES: Record<EscrowErrorCode, string> = {
  PAYMENT_FAILED: 'Payment could not be processed. Please check your payment details and try again.',
  INSUFFICIENT_FUNDS: 'Insufficient funds in your account. Please add funds and try again.',
  ESCROW_NOT_FOUND: 'Payment record not found. Please contact support if you believe this is an error.',
  ESCROW_ALREADY_RELEASED: 'Payment has already been released to the seller.',
  ESCROW_EXPIRED: 'Payment window has expired. Please create a new order.',
  TRANSFER_NOT_CONFIRMED: 'Share transfer has not been confirmed yet. Please wait for seller confirmation.',
  GATEWAY_ERROR: 'Payment gateway is temporarily unavailable. Please try again in a few minutes.',
  TIMEOUT: 'Payment request timed out. Please try again.',
  PROCESSING_ERROR: 'Payment is being processed. Please wait and do not retry.',
  REFUND_FAILED: 'Refund could not be processed. Our team will manually process it within 3-5 business days.',
  INVALID_AMOUNT: 'Invalid payment amount. Please refresh and try again.',
};

/**
 * Document Error (400)
 * Used for document upload and verification issues
 */
export class DocumentError extends AppError {
  public readonly errorCode: DocumentErrorCode;

  constructor(
    errorCode: DocumentErrorCode,
    message: string,
    context?: ErrorContext
  ) {
    super(message, 400, undefined, false, context);
    this.errorCode = errorCode;
  }

  protected getDefaultUserMessage(): string {
    return DOCUMENT_ERROR_MESSAGES[this.errorCode] || 'Document upload issue. Please try again.';
  }
}

export type DocumentErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FORMAT'
  | 'UPLOAD_FAILED'
  | 'DOCUMENT_EXPIRED'
  | 'DOCUMENT_REJECTED'
  | 'VERIFICATION_PENDING'
  | 'DUPLICATE_DOCUMENT';

export const DOCUMENT_ERROR_MESSAGES: Record<DocumentErrorCode, string> = {
  FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
  INVALID_FORMAT: 'Invalid file format. Please upload PDF, JPG, or PNG files.',
  UPLOAD_FAILED: 'Upload failed. Please check your connection and try again.',
  DOCUMENT_EXPIRED: 'This document has expired. Please upload a current version.',
  DOCUMENT_REJECTED: 'Document was rejected. Please upload a clearer copy.',
  VERIFICATION_PENDING: 'Document is being verified. You will be notified once complete.',
  DUPLICATE_DOCUMENT: 'This document has already been uploaded.',
};

/**
 * Deal Lifecycle Error (400/409)
 * Used for deal state transition issues
 */
export class DealLifecycleError extends AppError {
  public readonly currentStatus: string;
  public readonly attemptedAction: string;

  constructor(
    currentStatus: string,
    attemptedAction: string,
    context?: ErrorContext
  ) {
    super(
      `Cannot ${attemptedAction} deal in ${currentStatus} status`,
      409,
      undefined,
      false,
      context
    );
    this.currentStatus = currentStatus;
    this.attemptedAction = attemptedAction;
  }

  protected getDefaultUserMessage(): string {
    const statusMessages: Record<string, string> = {
      'matched': 'This deal is awaiting confirmation from both parties.',
      'payment_pending': 'This deal is awaiting payment from the buyer.',
      'paid': 'Payment received. Awaiting share transfer confirmation.',
      'shares_transferred': 'Shares have been transferred. Awaiting final confirmation.',
      'completed': 'This deal has already been completed.',
      'cancelled': 'This deal has been cancelled and cannot be modified.',
      'disputed': 'This deal is under review by our team.',
    };
    return statusMessages[this.currentStatus] || `Deal is currently ${this.currentStatus} and cannot be modified.`;
  }
}

/**
 * Helper function to create unlisted trading error
 */
export function createUnlistedError(
  code: UnlistedErrorCode,
  additionalInfo?: string,
  context?: ErrorContext
): UnlistedTradingError {
  const baseMessage = UNLISTED_ERROR_MESSAGES[code];
  const message = additionalInfo ? `${baseMessage} ${additionalInfo}` : baseMessage;
  return new UnlistedTradingError(code, message, context);
}

/**
 * Helper function to create escrow error
 */
export function createEscrowError(
  code: EscrowErrorCode,
  additionalInfo?: string,
  context?: ErrorContext
): EscrowError {
  const baseMessage = ESCROW_ERROR_MESSAGES[code];
  const message = additionalInfo ? `${baseMessage} ${additionalInfo}` : baseMessage;
  const isRetryable = ['GATEWAY_ERROR', 'TIMEOUT'].includes(code);
  return new EscrowError(code, message, isRetryable, context);
}
