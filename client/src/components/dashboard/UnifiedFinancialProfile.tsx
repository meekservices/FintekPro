import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedFinancialProfile } from "@/hooks/use-mpal";
import { Landmark, TrendingUp, CreditCard, ShieldCheck, Activity, Target } from "lucide-react";

export function UnifiedFinancialProfile() {
  const { data: profile, isLoading, isError } = useUnifiedFinancialProfile();

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (isError || !profile) {
    return null; // Fallback gracefully if MPAL profile fails to load
  }

  const netWorth = parseFloat(profile.netWorth || "0");
  const totalAssets = parseFloat(profile.totalAssets || "0");
  const totalLiabilities = parseFloat(profile.totalLiabilities || "0");
  const creditUtilization = parseFloat(profile.creditUtilization || "0");
  const riskScore = parseFloat(profile.riskScore || "0");

  return (
    <Card className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 border-none text-white shadow-xl overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 bg-white opacity-5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 bg-blue-400 opacity-10 rounded-full blur-3xl"></div>

      <CardContent className="p-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-center">
          
          {/* Main Net Worth */}
          <div className="lg:col-span-1 space-y-2 border-b lg:border-b-0 lg:border-r border-white/20 pb-6 lg:pb-0 pr-0 lg:pr-6">
            <div className="flex items-center gap-2 text-white/80">
              <Landmark className="h-5 w-5" />
              <span className="font-medium text-sm tracking-wide uppercase">Unified Net Worth</span>
            </div>
            <div className="text-4xl lg:text-5xl font-bold tracking-tight">
              ₹{netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 transition-colors">
                <ShieldCheck className="h-3 w-3 mr-1 text-green-400" />
                Score: {riskScore}
              </Badge>
              <span className="text-xs text-white/60">Updated Live</span>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Total Assets */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">Total Assets</p>
                  <p className="text-xl font-bold text-white">
                    ₹{totalAssets.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-green-400 h-full rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Total Liabilities */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">Total Liabilities</p>
                  <p className="text-xl font-bold text-white">
                    ₹{totalLiabilities.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-red-400 h-full rounded-full" 
                  style={{ width: `${Math.min((totalLiabilities / (totalAssets || 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Credit Utilization */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/10 transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-white/70 font-medium">Credit Utilization</p>
                  <p className="text-xl font-bold text-white">
                    {creditUtilization.toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${creditUtilization > 80 ? 'bg-red-400' : creditUtilization > 50 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                ></div>
              </div>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  );
}
