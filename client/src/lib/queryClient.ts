import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      const json = await res.json();
      const errorMessage = json.error || json.message || res.statusText;
      throw new Error(errorMessage);
    } catch (parseError) {
      throw new Error(res.statusText);
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
  
  const res = await fetch(url, {
    method,
    headers: shouldSendBody ? { "Content-Type": "application/json", ...headers } : headers,
    body: shouldSendBody ? JSON.stringify(body) : undefined,
    credentials: "include",
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
