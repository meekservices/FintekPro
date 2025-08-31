import { useQuery } from "@tanstack/react-query";
import { type User } from "@shared/schema";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user, // current authenticated client
    isLoading,
    isAuthenticated: !!user,
  };
}