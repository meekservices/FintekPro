import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { type User } from "@shared/schema";
import { getQueryFn, markUserAuthenticated } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  useEffect(() => {
    if (user) {
      markUserAuthenticated();
    }
  }, [user]);

  return {
    user, // current authenticated client
    isLoading,
    isAuthenticated: !!user,
  };
}