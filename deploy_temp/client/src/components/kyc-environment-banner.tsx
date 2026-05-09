import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Shield, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function KycEnvironmentBanner() {
  const { data } = useQuery<{
    success: boolean;
    environment: string;
    fixedOtpEnabled: boolean;
    providers: Record<string, { provider: string; displayName?: string; status: string; environment: string }>;
  }>({
    queryKey: ['/api/kyc/environment/status'],
    retry: false,
    staleTime: 300000,
  });

  if (!data?.success) return null;

  const isSandbox = data.environment === 'sandbox';

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-sm rounded-lg mb-4 ${
      isSandbox 
        ? 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200'
        : 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
    }`}>
      <div className="flex items-center gap-2">
        {isSandbox ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span className="font-medium">
          {isSandbox ? 'Sandbox Environment' : 'Production Environment'}
        </span>
        {data.fixedOtpEnabled && (
          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900">
            Fixed OTP: 123456
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-2">
        {data.providers && Object.entries(data.providers).map(([service, info]) => {
          const statusColor = info.status === 'mock' ? 'text-red-500' : 'text-green-600';
          const label = info.displayName || info.provider;
          return (
            <div key={service} className="flex items-center gap-1">
              <Wifi className={`h-3 w-3 ${statusColor}`} />
              <span className="text-xs capitalize">{service}: {label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
