import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useState } from "react";

export type NavPosition = "left" | "top" | "bottom";

interface UserPreferences {
  navPosition: NavPosition;
}

const PREFERENCES_CACHE_KEY = "user-preferences";

export function useUserPreferences() {
  const [localNavPosition, setLocalNavPosition] = useState<NavPosition>(() => {
    try {
      const cached = localStorage.getItem(PREFERENCES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.navPosition || "left";
      }
    } catch {
      // ignore
    }
    return "left";
  });

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  useEffect(() => {
    if (preferences?.navPosition) {
      setLocalNavPosition(preferences.navPosition);
      localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify(preferences));
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: Partial<UserPreferences>) => {
      const response = await apiRequest("PATCH", "/api/user/preferences", newPreferences);
      return response.json();
    },
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({ queryKey: ["/api/user/preferences"] });
      const previousPreferences = queryClient.getQueryData<UserPreferences>(["/api/user/preferences"]);
      
      if (newPreferences.navPosition) {
        setLocalNavPosition(newPreferences.navPosition);
        localStorage.setItem(PREFERENCES_CACHE_KEY, JSON.stringify({
          ...previousPreferences,
          ...newPreferences,
        }));
      }

      queryClient.setQueryData<UserPreferences>(["/api/user/preferences"], (old) => ({
        ...old,
        ...newPreferences,
      } as UserPreferences));

      return { previousPreferences };
    },
    onError: (_err, _newPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(["/api/user/preferences"], context.previousPreferences);
        setLocalNavPosition(context.previousPreferences.navPosition || "left");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const setNavPosition = (position: NavPosition) => {
    updatePreferencesMutation.mutate({ navPosition: position });
  };

  return {
    navPosition: localNavPosition,
    setNavPosition,
    isLoading,
    isPending: updatePreferencesMutation.isPending,
  };
}
