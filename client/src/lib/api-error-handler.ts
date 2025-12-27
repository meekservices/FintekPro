import { trackError, trackNetworkError, trackPaymentError, trackKycError } from './error-tracking';

export type ApiErrorType = 'network' | 'validation' | 'authentication' | 'authorization' | 'server' | 'timeout' | 'unknown';

export interface ApiError {
  type: ApiErrorType;
  status?: number;
  message: string;
  errorCode?: string;
  errorId?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

interface HandleApiErrorOptions {
  operation: string;
  module?: string;
  transactionId?: string;
  clientId?: string;
  silent?: boolean;
}

export function classifyHttpError(status: number, message?: string): ApiError {
  if (status === 0 || !status) {
    return {
      type: 'network',
      message: 'Unable to connect to the server. Please check your internet connection.',
      retryable: true
    };
  }

  if (status === 408 || status === 504) {
    return {
      type: 'timeout',
      status,
      message: 'The request took too long. Please try again.',
      retryable: true
    };
  }

  if (status === 401) {
    return {
      type: 'authentication',
      status,
      message: 'Your session has expired. Please log in again.',
      retryable: false
    };
  }

  if (status === 403) {
    return {
      type: 'authorization',
      status,
      message: 'You do not have permission to perform this action.',
      retryable: false
    };
  }

  if (status >= 400 && status < 500) {
    return {
      type: 'validation',
      status,
      message: message || 'The request was invalid. Please check your input and try again.',
      retryable: false
    };
  }

  if (status >= 500) {
    return {
      type: 'server',
      status,
      message: 'Something went wrong on our end. Please try again later.',
      retryable: true
    };
  }

  return {
    type: 'unknown',
    status,
    message: message || 'An unexpected error occurred.',
    retryable: true
  };
}

export async function handleApiError(
  error: unknown,
  options: HandleApiErrorOptions
): Promise<ApiError> {
  const { operation, module = 'api', transactionId, clientId, silent = false } = options;

  let apiError: ApiError;
  let originalError: Error | null = null;

  if (error instanceof Response) {
    let errorBody: any = {};
    try {
      errorBody = await error.json();
    } catch {
      try {
        errorBody = { message: await error.text() };
      } catch {
        errorBody = { message: 'Unknown error' };
      }
    }
    
    apiError = classifyHttpError(error.status, errorBody.message);
    apiError.errorCode = errorBody.errorCode || errorBody.code;
    apiError.details = errorBody;
  } else if (error instanceof TypeError && error.message.includes('fetch')) {
    apiError = {
      type: 'network',
      message: 'Unable to connect to the server. Please check your internet connection.',
      retryable: true
    };
    originalError = error;
  } else if (error instanceof Error) {
    if (error.name === 'AbortError') {
      apiError = {
        type: 'timeout',
        message: 'The request was cancelled.',
        retryable: true
      };
    } else {
      apiError = {
        type: 'unknown',
        message: error.message || 'An unexpected error occurred.',
        retryable: true
      };
    }
    originalError = error;
  } else {
    apiError = {
      type: 'unknown',
      message: 'An unexpected error occurred.',
      retryable: true
    };
  }

  if (!silent) {
    const errorCode = apiError.errorCode || `${apiError.type.toUpperCase()}_${operation.toUpperCase().replace(/\s+/g, '_')}`;
    
    let trackPromise: Promise<string | null>;
    
    if (apiError.type === 'network') {
      trackPromise = trackNetworkError(
        errorCode,
        apiError.message,
        module,
        { transactionId, clientId }
      );
    } else if (module === 'payment' || operation.toLowerCase().includes('payment')) {
      trackPromise = trackPaymentError(
        errorCode,
        apiError.message,
        transactionId,
        apiError.status,
        { clientId }
      );
    } else if (module === 'kyc' || operation.toLowerCase().includes('kyc')) {
      trackPromise = trackKycError(
        errorCode,
        apiError.message,
        'error',
        { clientId }
      );
    } else {
      trackPromise = trackError({
        errorCode,
        message: `${operation}: ${apiError.message}`,
        severity: apiError.type === 'server' ? 'error' : 'warning',
        stack: originalError?.stack,
        context: {
          module,
          transactionId,
          clientId,
          metadata: {
            operation,
            errorType: apiError.type,
            status: apiError.status,
            details: apiError.details
          }
        }
      });
    }
    
    const errorId = await trackPromise;
    if (errorId) {
      apiError.errorId = errorId;
    }
  }

  return apiError;
}

export function isRetryable(error: ApiError): boolean {
  return error.retryable && error.type !== 'authentication' && error.type !== 'authorization';
}

export function getUserFriendlyMessage(error: ApiError): string {
  switch (error.type) {
    case 'network':
      return 'Connection problem. Please check your internet and try again.';
    case 'timeout':
      return 'The server is taking too long to respond. Please try again.';
    case 'authentication':
      return 'Your session has expired. Please log in again.';
    case 'authorization':
      return 'You don\'t have permission to do this.';
    case 'validation':
      return error.message || 'Please check your input and try again.';
    case 'server':
      return 'Something went wrong. Our team has been notified.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: HandleApiErrorOptions
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const data = await operation();
    return { data };
  } catch (err) {
    const error = await handleApiError(err, options);
    return { error };
  }
}
