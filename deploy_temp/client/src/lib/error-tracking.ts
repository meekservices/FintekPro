import { apiRequest } from './queryClient';

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
type ErrorModule = 'kyc' | 'mutual_fund' | 'aif' | 'pms' | 'bond' | 'ncd' | 'ipo' | 'stock' | 
  'unlisted' | 'tax' | 'itr' | 'payment' | 'auth' | 'portfolio' | 'store' |
  'admin' | 'agent' | 'partner' | 'notification' | 'document' | 'api' | 'system';

interface ErrorContext {
  module: ErrorModule | string;
  clientId?: string;
  agentId?: string;
  transactionId?: string;
  pan?: string;
  requestId?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

interface TrackErrorOptions {
  errorCode: string;
  message: string;
  severity?: ErrorSeverity;
  stack?: string;
  context?: Partial<ErrorContext>;
  sentryEventId?: string;
}

let sentryInstance: any = null;
let sentryInitialized = false;

export async function initSentry() {
  if (sentryInitialized) return;
  
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (!sentryDsn) {
    console.log('[ErrorTracking] Sentry DSN not configured - using API-only tracking');
    sentryInitialized = true;
    return;
  }
  
  console.log('[ErrorTracking] Sentry package not installed - using API-only tracking');
  console.log('[ErrorTracking] To enable Sentry, install @sentry/react package');
  sentryInitialized = true;
}

export function setSentryUser(user: { id: string; email?: string; role?: string }) {
  if (sentryInstance) {
    sentryInstance.setUser({
      id: user.id,
      role: user.role
    });
  }
}

export function setSentryTags(tags: Record<string, string>) {
  if (sentryInstance) {
    Object.entries(tags).forEach(([key, value]) => {
      sentryInstance.setTag(key, value);
    });
  }
}

function detectModule(): ErrorModule {
  const path = window.location.pathname;
  
  if (path.includes('/kyc') || path.includes('/onboarding')) return 'kyc';
  if (path.includes('/mutual-fund') || path.includes('/mf')) return 'mutual_fund';
  if (path.includes('/aif')) return 'aif';
  if (path.includes('/pms')) return 'pms';
  if (path.includes('/bond') || path.includes('/ncd')) return 'bond';
  if (path.includes('/ipo')) return 'ipo';
  if (path.includes('/stock') || path.includes('/equity')) return 'stock';
  if (path.includes('/unlisted')) return 'unlisted';
  if (path.includes('/tax') || path.includes('/itr')) return 'tax';
  if (path.includes('/payment') || path.includes('/checkout')) return 'payment';
  if (path.includes('/auth') || path.includes('/login')) return 'auth';
  if (path.includes('/portfolio')) return 'portfolio';
  if (path.includes('/store')) return 'store';
  if (path.includes('/admin')) return 'admin';
  if (path.includes('/agent')) return 'agent';
  if (path.includes('/partner')) return 'partner';
  
  return 'system';
}

export async function trackError(options: TrackErrorOptions): Promise<string | null> {
  const {
    errorCode,
    message,
    severity = 'error',
    stack,
    context = {},
    sentryEventId
  } = options;
  
  let sentry_event_id = sentryEventId;
  
  if (sentryInstance && severity !== 'info') {
    try {
      sentry_event_id = sentryInstance.captureMessage(message, {
        level: severity,
        tags: {
          errorCode,
          module: context.module || detectModule()
        },
        extra: context.metadata
      });
    } catch (err) {
      console.error('[ErrorTracking] Failed to send to Sentry:', err);
    }
  }
  
  try {
    const response = await apiRequest('/api/errors/ingest', {
      method: 'POST',
      body: JSON.stringify({
        source: 'frontend',
        severity,
        errorCode,
        message,
        stack,
        context: {
          module: context.module || detectModule(),
          clientId: context.clientId,
          agentId: context.agentId,
          transactionId: context.transactionId,
          pan: context.pan,
          requestId: context.requestId,
          url: context.url || window.location.href,
          userAgent: context.userAgent || navigator.userAgent,
          metadata: context.metadata
        },
        sentryEventId: sentry_event_id,
        buildVersion: import.meta.env.VITE_BUILD_VERSION || 'dev'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = typeof response?.json === 'function' ? await response.json() : response;
    return (result as any)?.errorId || null;
  } catch (err) {
    console.error('[ErrorTracking] Failed to ingest error to API:', err);
    return null;
  }
}

export function trackException(error: Error, context?: Partial<ErrorContext>): Promise<string | null> {
  return trackError({
    errorCode: 'UNKNOWN_ERROR',
    message: error.message,
    severity: 'error',
    stack: error.stack,
    context: {
      ...context,
      metadata: {
        ...context?.metadata,
        errorName: error.name
      }
    }
  });
}

export function trackNetworkError(
  url: string, 
  status: number, 
  message: string,
  context?: Partial<ErrorContext>
): Promise<string | null> {
  let errorCode = 'NETWORK_DISCONNECTED';
  let severity: ErrorSeverity = 'error';
  
  if (status === 0 || !navigator.onLine) {
    errorCode = 'NETWORK_DISCONNECTED';
  } else if (status === 401) {
    errorCode = 'AUTH_UNAUTHORIZED';
    severity = 'warning';
  } else if (status === 403) {
    errorCode = 'PERMISSION_DENIED';
    severity = 'warning';
  } else if (status === 408 || status === 504) {
    errorCode = 'NETWORK_TIMEOUT';
  } else if (status === 429) {
    errorCode = 'API_RATE_LIMIT_EXCEEDED';
    severity = 'warning';
  } else if (status >= 500) {
    errorCode = 'SERVER_INTERNAL_ERROR';
    severity = 'critical';
  }
  
  return trackError({
    errorCode,
    message,
    severity,
    context: {
      ...context,
      url,
      metadata: {
        ...context?.metadata,
        httpStatus: status
      }
    }
  });
}

export function trackPaymentError(
  transactionId: string,
  gateway: string,
  message: string,
  context?: Partial<ErrorContext>
): Promise<string | null> {
  return trackError({
    errorCode: 'PAYMENT_GATEWAY_FAILURE',
    message,
    severity: 'critical',
    context: {
      ...context,
      module: 'payment',
      transactionId,
      metadata: {
        ...context?.metadata,
        gateway
      }
    }
  });
}

export function trackKYCError(
  step: string,
  errorCode: string,
  message: string,
  pan?: string,
  context?: Partial<ErrorContext>
): Promise<string | null> {
  return trackError({
    errorCode: errorCode || 'KYC_PAN_VERIFY_FAILED',
    message,
    severity: 'error',
    context: {
      ...context,
      module: 'kyc',
      pan,
      metadata: {
        ...context?.metadata,
        kycStep: step
      }
    }
  });
}

export function trackOrderError(
  orderType: 'mf' | 'bond' | 'stock' | 'ipo' | 'unlisted',
  transactionId: string,
  message: string,
  context?: Partial<ErrorContext>
): Promise<string | null> {
  const errorCodeMap: Record<string, string> = {
    mf: 'MF_ORDER_PLACEMENT_FAILED',
    bond: 'BOND_ORDER_FAILED',
    stock: 'STOCK_ORDER_FAILED',
    ipo: 'IPO_APPLICATION_FAILED',
    unlisted: 'UNLISTED_DEAL_FAILED'
  };
  
  return trackError({
    errorCode: errorCodeMap[orderType] || 'UNKNOWN_ERROR',
    message,
    severity: 'critical',
    context: {
      ...context,
      module: orderType === 'mf' ? 'mutual_fund' : orderType,
      transactionId,
    }
  });
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
