import { QueryClient, QueryFunction } from "@tanstack/react-query";

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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const json = await res.json();
      
      // Handle new error schema with { success: false, error, message, code, traceId }
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
      
      // Fallback for old error format
      const errorMessage = json.error || json.message || res.statusText;
      throw new ApiError(errorMessage, res.status);
    } catch (parseError) {
      // If response isn't JSON, use status text
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

  await throwIfResNotOk(res);
  
  // Parse JSON if response has content
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
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
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
