import { QueryClient, QueryFunction } from "@tanstack/react-query";

// CSRF Token Management
let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken || '';
  } catch (error) {
    console.error('CSRF token fetch failed:', error);
    return '';
  }
}

// Initialize CSRF token on app load
fetchCsrfToken();

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    
    // If response is HTML, don't try to parse as JSON
    if (contentType?.includes("text/html")) {
      throw new Error(`Request failed: ${res.statusText}. The server returned an error page.`);
    }
    
    try {
      const json = await res.json();
      const errorMessage = json.error || json.message || res.statusText;
      throw new Error(errorMessage);
    } catch (parseError) {
      throw new Error(res.statusText || "An unexpected error occurred");
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<any> {
  const { body, headers = {} } = options || {};
  
  // Don't send body for GET requests
  const shouldSendBody = method !== "GET" && body !== undefined;
  
  // Add CSRF token for state-changing requests
  const requestHeaders = { ...headers };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    // If token is not available, fetch it
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      requestHeaders['x-csrf-token'] = csrfToken;
    }
  }
  
  if (shouldSendBody) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: shouldSendBody ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // If we get a CSRF error, refresh token and retry once
  if (res.status === 403) {
    try {
      const error = await res.json();
      if (error.code === 'CSRF_VALIDATION_FAILED') {
        await fetchCsrfToken();
        // Retry the request with new token
        requestHeaders['x-csrf-token'] = csrfToken || '';
        const retryRes = await fetch(url, {
          method,
          headers: requestHeaders,
          body: shouldSendBody ? JSON.stringify(body) : undefined,
          credentials: "include",
        });
        await throwIfResNotOk(retryRes);
        const contentType = retryRes.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return await retryRes.json();
        }
        return retryRes;
      }
    } catch (e) {
      // If parsing fails, continue to normal error handling
    }
  }

  await throwIfResNotOk(res);
  
  // Parse JSON if response has content
  const contentType = res.headers.get("content-type");
  console.log(`🔍 [apiRequest] Response content-type: "${contentType}"`);
  console.log(`🔍 [apiRequest] Includes JSON check: ${contentType?.includes("application/json")}`);
  
  if (contentType?.includes("application/json")) {
    const jsonData = await res.json();
    console.log(`🔍 [apiRequest] Parsed JSON:`, jsonData);
    return jsonData;
  }
  
  // For successful non-JSON responses, return the raw response
  console.log(`⚠️ [apiRequest] No JSON content-type, returning raw response`);
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
        // Don't retry for 4xx errors except 408 (timeout)
        if (error?.status >= 400 && error?.status < 500 && error?.status !== 408) {
          return false;
        }
        // Retry network errors and 5xx errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Only retry mutations for network errors
        if (!error?.status || error?.status >= 500) {
          return failureCount < 1;
        }
        return false;
      },
    },
  },
});
