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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      retry: (failureCount, error: any) => {
        // Don't retry for 4xx errors except 408 (timeout) and 429 (rate limit)
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) {
            // Retry timeouts and rate limits
            if (error.status === 408 || error.status === 429) {
              return failureCount < 3;
            }
            return false;
          }
          // Retry 5xx and network errors
          return failureCount < 2;
        }
        // Retry unknown errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        // Rate limit errors may include retry-after
        if (error instanceof ApiError && error.status === 429) {
          // Exponential backoff with longer delays for rate limits
          return Math.min(5000 * 2 ** attemptIndex, 60000);
        }
        // Standard exponential backoff
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
    },
    mutations: {
      retry: (failureCount, error: any) => {
        if (error instanceof ApiError) {
          // Only retry mutations for 5xx errors and network failures
          if (error.status >= 500 || !error.status) {
            return failureCount < 1;
          }
          // Retry rate limits once
          if (error.status === 429) {
            return failureCount < 1;
          }
        }
        return false;
      },
      retryDelay: (attemptIndex, error) => {
        if (error instanceof ApiError && error.status === 429) {
          return 5000; // Wait 5s for rate limit
        }
        return 2000;
      },
    },
  },
});
