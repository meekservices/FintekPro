import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { CurrentUser } from "@/types/user";

export function useAuth() {
  const { data: user, isLoading } = useQuery<CurrentUser | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user, // current authenticated client with KYC status
    isLoading,
    isAuthenticated: !!user,
  };
}