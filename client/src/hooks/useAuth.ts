import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type User, type InsertUser } from "@shared/schema";
import {
	getQueryFn,
	markUserAuthenticated,
	fetchCsrfToken,
	clearCsrfToken,
	clearStoredSessionId,
	clearAuthenticationFlag,
	apiRequest,
} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	const {
		data: user,
		isLoading,
		error,
	} = useQuery<User>({
		queryKey: ["/api/user"],
		queryFn: getQueryFn({ on401: "returnNull" }),
		retry: false,
		// Never re-fetch /api/user in the background — session is established at
		// login and remains valid for 30 days. Background re-fetches cause spurious
		// 401s on page navigation when the new Cloud Run container is still warming
		// its DB pool. The session-expired dialog handles true expiry.
		staleTime: Infinity,
		gcTime: Infinity,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});

	const loginMutation = useMutation({
		mutationFn: async (credentials: {
			identifier: string;
			password?: string;
		}) => {
			return await apiRequest("/api/login", "POST", credentials);
		},
		onSuccess: (user: User) => {
			queryClient.setQueryData(["/api/user"], user);
			markUserAuthenticated();
			fetchCsrfToken();
		},
		onError: (error: Error) => {
			toast({
				title: "Login failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const registerMutation = useMutation({
		mutationFn: async (newUser: InsertUser) => {
			return await apiRequest("/api/register", "POST", newUser);
		},
		onSuccess: (user: User) => {
			queryClient.setQueryData(["/api/user"], user);
			markUserAuthenticated();
			fetchCsrfToken();
		},
		onError: (error: Error) => {
			toast({
				title: "Registration failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			await apiRequest("/api/logout", "POST");
		},
		onSuccess: () => {
			// Clear all client-side auth artifacts so the X-Session-ID header
			// is not sent on subsequent requests and the user is fully signed out.
			clearStoredSessionId(); // removes fintekpro_sid from localStorage
			clearAuthenticationFlag(); // removes fintekpro_was_authenticated from sessionStorage
			clearCsrfToken(); // clears CSRF token + in-memory session ID reference
			queryClient.setQueryData(["/api/user"], null);
			queryClient.clear();
			// Hard redirect so all React in-memory state (including any cached queries)
			// is wiped — prevents the user from pressing Back and seeing authenticated pages.
			window.location.href = "/auth";
		},
		onError: (error: Error) => {
			toast({
				title: "Logout failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (user) {
			markUserAuthenticated();
			fetchCsrfToken();
		}
	}, [user]);

	return {
		user,
		isLoading,
		error,
		isAuthenticated: !!user,
		loginMutation,
		registerMutation,
		logoutMutation,
		logout: logoutMutation.mutate,
	};
}
