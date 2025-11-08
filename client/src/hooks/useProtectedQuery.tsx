import { useQuery, useMutation, UseQueryOptions, UseMutationOptions, QueryKey } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

/**
 * Protected query hook that automatically:
 * - Waits for authentication before executing
 * - Redirects to login if user is not authenticated
 * - Handles 401 errors gracefully
 */
export function useProtectedQuery<TData = unknown, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, 'queryKey'> & { queryKey: QueryKey }
) {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Redirect to login if not authenticated (after auth check completes)
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please login to access this feature",
        variant: "destructive"
      });
      setLocation("/login");
    }
  }, [user, authLoading, setLocation, toast]);

  const originalOnError = options.onError;

  return useQuery<TData, TError>({
    ...options,
    // Disable query until user is authenticated
    enabled: !!user && (options.enabled ?? true),
    // Handle 401 errors by redirecting to login
    onError: (error: TError) => {
      // Check if error indicates 401 Unauthorized
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("Unauthorized"))) {
        toast({
          title: "Session Expired",
          description: "Please login again to continue",
          variant: "destructive"
        });
        setLocation("/login");
      }

      // Call original error handler if provided
      if (originalOnError) {
        originalOnError(error);
      }
    },
  });
}

/**
 * Protected mutation hook that automatically:
 * - Checks authentication before allowing mutations
 * - Handles 401 errors with redirect to login
 */
export function useProtectedMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
) {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const originalOnError = options.onError;

  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onError: (error, variables, context) => {
      // Handle 401 errors by redirecting to login
      if (error instanceof Error && error.message.includes("401")) {
        toast({
          title: "Session Expired",
          description: "Please login again to continue",
          variant: "destructive"
        });
        setLocation("/login");
      }

      // Call original error handler if provided
      if (originalOnError) {
        originalOnError(error, variables, context);
      }
    },
    mutationFn: async (variables) => {
      // Check authentication before executing mutation (including during loading)
      if (!user || authLoading) {
        toast({
          title: "Authentication Required",
          description: "Please login to perform this action",
          variant: "destructive"
        });
        setLocation("/login");
        throw new Error("Authentication required");
      }

      // Execute original mutation
      if (!options.mutationFn) {
        throw new Error("mutationFn is required");
      }
      return options.mutationFn(variables);
    },
  });
}

/**
 * Hook to check if user is authenticated and ready
 * Returns object with authentication state
 */
export function useAuthGuard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const redirectToLogin = () => {
    toast({
      title: "Authentication Required",
      description: "Please login to access this page",
      variant: "destructive"
    });
    setLocation("/login");
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    redirectToLogin,
  };
}
