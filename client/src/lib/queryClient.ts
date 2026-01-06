import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { notifySessionExpired } from "@/contexts/session-context";

const EXCLUDED_401_ENDPOINTS = [
  "/api/user",
  "/api/cart",
  "/api/unified-cart",
  "/api/user/preferences",
  "/api/kyc/notification-status"
];

let wasEverAuthenticated = false;

export function markUserAuthenticated() {
  wasEverAuthenticated = true;
  try {
    sessionStorage.setItem('fintekpro_was_authenticated', 'true');
  } catch (e) {}
}

export function checkWasAuthenticated(): boolean {
  if (wasEverAuthenticated) return true;
  try {
    wasEverAuthenticated = sessionStorage.getItem('fintekpro_was_authenticated') === 'true';
  } catch (e) {}
  return wasEverAuthenticated;
}

export function clearAuthenticationFlag() {
  wasEverAuthenticated = false;
  try {
    sessionStorage.removeItem('fintekpro_was_authenticated');
  } catch (e) {}
}

function shouldTriggerSessionExpired(url: string): boolean {
  if (!checkWasAuthenticated()) {
    return false;
  }
  return !EXCLUDED_401_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

export class ApiError extends Error {
  status: number;
  code?: string;
  traceId?: string;
  userMessage?: string;
  details?: any;

  constructor(
    message: string,
    status: number,
    options?: {
      code?: string;
      traceId?: string;
      userMessage?: string;
      details?: any;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code;
    this.traceId = options?.traceId;
    this.userMessage = options?.userMessage;
    this.details = options?.details;
  }

  getUserFriendlyMessage(): string {
    return this.userMessage || this.message || 'An unexpected error occurred';
  }
}

async function throwIfResNotOk(res: Response, url?: string) {
  if (!res.ok) {
    const requestUrl = url || res.url;
    
    if (res.status === 401 && shouldTriggerSessionExpired(requestUrl)) {
      notifySessionExpired({ url: requestUrl });
      throw new ApiError("Session expired", 401, {
        code: "SESSION_EXPIRED",
        userMessage: "Your session has expired. Please sign in again.",
      });
    }
    
    try {
      const json = await res.json();
      
      if (json.success === false) {
        throw new ApiError(
          json.error || json.message || res.statusText,
          res.status,
          {
            code: json.code,
            traceId: json.traceId,
            userMessage: json.message,
            details: json.details,
          }
        );
      }
      
      const errorMessage = json.error || json.message || res.statusText;
      throw new ApiError(errorMessage, res.status);
    } catch (parseError) {
      if (parseError instanceof ApiError) {
        throw parseError;
      }
      throw new ApiError(res.statusText, res.status);
    }
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit
): Promise<any> {
  const { method = "GET", body, headers = {}, ...restOptions } = options || {};
  
  // Don't send body for GET requests
  const shouldSendBody = method !== "GET" && body !== undefined;
  
  const res = await fetch(url, {
    method,
    headers: shouldSendBody ? { "Content-Type": "application/json", ...headers } : headers,
    body: shouldSendBody ? body : undefined,
    credentials: "include",
    ...restOptions,
  });

  await throwIfResNotOk(res, url);
  
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await res.json();
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      if (shouldTriggerSessionExpired(url)) {
        notifySessionExpired({ url, queryKey });
        throw new ApiError("Session expired", 401, {
          code: "SESSION_EXPIRED",
          userMessage: "Your session has expired. Please sign in again.",
        });
      }
    }

    await throwIfResNotOk(res, url);
    return await res.json();
  };

function isSlowNetwork(): boolean {
  const connection = (navigator as any).connection || 
                     (navigator as any).mozConnection || 
                     (navigator as any).webkitConnection;
  
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return true;
    }
    if (effectiveType === '3g' && connection.rtt && connection.rtt > 400) {
      return true;
    }
    if (connection.downlink !== undefined && connection.downlink < 0.5) {
      return true;
    }
  }
  return false;
}

function getNetworkAwareStaleTime(): number {
  return isSlowNetwork() ? 10 * 60 * 1000 : 5 * 60 * 1000;
}

function getNetworkAwareRetryCount(): number {
  return isSlowNetwork() ? 4 : 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      networkMode: 'offlineFirst',
      retry: (failureCount, error: any) => {
        const maxRetries = getNetworkAwareRetryCount();
        
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) {
            if (error.status === 408 || error.status === 429) {
              return failureCount < maxRetries + 1;
            }
            return false;
          }
          return failureCount < maxRetries;
        }
        
        if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
          return failureCount < maxRetries + 2;
        }
        
        return failureCount < maxRetries;
      },
      retryDelay: (attemptIndex, error) => {
        const baseDelay = isSlowNetwork() ? 2000 : 1000;
        const maxDelay = isSlowNetwork() ? 60000 : 30000;
        
        if (error instanceof ApiError && error.status === 429) {
          return Math.min(5000 * 2 ** attemptIndex, 60000);
        }
        
        return Math.min(baseDelay * 2 ** attemptIndex, maxDelay);
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        const maxRetries = isSlowNetwork() ? 2 : 1;
        
        if (error instanceof ApiError) {
          if (error.status >= 500 || !error.status) {
            return failureCount < maxRetries;
          }
          if (error.status === 429) {
            return failureCount < maxRetries;
          }
        }
        
        if (error?.name === 'TypeError' && error?.message?.includes('fetch')) {
          return failureCount < maxRetries + 1;
        }
        
        return false;
      },
      retryDelay: (attemptIndex, error) => {
        const baseDelay = isSlowNetwork() ? 4000 : 2000;
        
        if (error instanceof ApiError && error.status === 429) {
          return 5000;
        }
        return baseDelay * (attemptIndex + 1);
      },
    },
  },
});
