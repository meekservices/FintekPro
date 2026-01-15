import { useQuery } from "@tanstack/react-query";

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetAudience: string[];
}

interface FeatureFlagsData {
  flags: FeatureFlag[];
  abTests: any[];
  stats: {
    activeFlags: number;
    runningTests: number;
    totalUsers: number;
  };
}

export function useFeatureFlags() {
  return useQuery<FeatureFlagsData>({
    queryKey: ["/api/feature-flags"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useFeatureFlag(flagKey: string): { enabled: boolean; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ enabled: boolean }>({
    queryKey: [`/api/feature-flags/check/${flagKey}`],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    enabled: data?.enabled ?? false,
    isLoading,
  };
}

export function usePortfolioV3Enabled(): boolean {
  const { data } = useQuery<{ enabled: boolean }>({
    queryKey: [`/api/feature-flags/check/portfolio_v3`],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return data?.enabled ?? false;
}
