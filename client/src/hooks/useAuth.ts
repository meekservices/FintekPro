import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { type User } from "@shared/schema";
import { getQueryFn, markUserAuthenticated, fetchCsrfToken, clearCsrfToken } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  useEffect(() => {
    if (user) {
      markUserAuthenticated();
      fetchCsrfToken();
    } else {
      clearCsrfToken();
    }
  }, [user]);

  return {
    user, // current authenticated client
    isLoading,
    isAuthenticated: !!user,
  };
}