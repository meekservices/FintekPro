import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function usePanConsent() {
  const queryClient = useQueryClient();

  const { data: consentData, isLoading } = useQuery({
    queryKey: ["/api/pan-consent/check"],
    retry: false,
  });

  const recordConsentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pan-consent/record");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pan-consent/check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    }
  });

  return {
    hasConsent: consentData?.hasConsent || false,
    isLoading,
    recordConsent: recordConsentMutation.mutate,
    isRecording: recordConsentMutation.isPending,
  };
}