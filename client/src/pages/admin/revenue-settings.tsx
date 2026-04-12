import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Percent, TrendingUp, Users, Save, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

export default function RevenueSettingsTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/revenue-config"],
  });

  const [fees, setFees] = useState({
    PLATFORM_FEE_PERCENT: 10,
    REFERRAL_BONUS_PERCENT: 5,
  });

  useEffect(() => {
    if (data?.configs) {
      const newFees = { ...fees };
      data.configs.forEach((cfg: any) => {
        if (cfg.configKey === "PLATFORM_FEE_PERCENT") newFees.PLATFORM_FEE_PERCENT = Number(cfg.configValue);
        if (cfg.configKey === "REFERRAL_BONUS_PERCENT") newFees.REFERRAL_BONUS_PERCENT = Number(cfg.configValue);
      });
      setFees(newFees);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: { configKey: string; configValue: number; description: string }) => {
      return apiRequest("/api/admin/revenue-config", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/revenue-config"] });
      toast({
        title: "Configuration Updated",
        description: "Revenue settings have been updated and are now live.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdate = (key: string, value: number, description: string) => {
    mutation.mutate({ configKey: key, configValue: value, description });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Revenue Model Configuration
          </CardTitle>
          <CardDescription>
            Configure platform-wide transaction fees and referral incentives. 
            All changes are logged for regulatory audit packs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Platform Fee */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Percent className="w-4 h-4" />
                Platform Fee (Marketplace)
              </div>
              <p className="text-sm text-muted-foreground">
                The percentage of the total transaction value kept by FintekPro for CA marketplace consultations.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Current Percentage (%)</Label>
                  <Input 
                    type="number" 
                    value={fees.PLATFORM_FEE_PERCENT}
                    onChange={(e) => setFees({ ...fees, PLATFORM_FEE_PERCENT: Number(e.target.value) })}
                    className="font-mono"
                  />
                </div>
                <Button 
                  onClick={() => handleUpdate("PLATFORM_FEE_PERCENT", fees.PLATFORM_FEE_PERCENT, "Updated via Admin Panel")}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Update
                </Button>
              </div>
            </div>

            {/* Referral Bonus */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 text-purple-600 font-semibold">
                <Users className="w-4 h-4" />
                Partner Referral Bonus
              </div>
              <p className="text-sm text-muted-foreground">
                The percentage of the total transaction value paid to the referring partner (CA/Sub-broker).
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Current Percentage (%)</Label>
                  <Input 
                    type="number" 
                    value={fees.REFERRAL_BONUS_PERCENT}
                    onChange={(e) => setFees({ ...fees, REFERRAL_BONUS_PERCENT: Number(e.target.value) })}
                    className="font-mono"
                  />
                </div>
                <Button 
                  variant="outline"
                  className="border-purple-200 hover:bg-purple-50"
                  onClick={() => handleUpdate("REFERRAL_BONUS_PERCENT", fees.REFERRAL_BONUS_PERCENT, "Updated via Admin Panel")}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Update
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-950 dark:border-emerald-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="text-sm text-emerald-800 dark:text-emerald-200">
              <p className="font-semibold">Compliance Active</p>
              <p>Updates to these settings are automatically captured in <strong>Regulatory Audit Packs</strong> for all subsequent transactions, ensuring full fee transparency for SEBI/AMFI audits.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
