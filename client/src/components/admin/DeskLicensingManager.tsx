import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  FileCheck2,
  Activity,
  Zap,
  PlayCircle,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DeskLicenseSummary {
  id: string;
  deskType: string;
  licenseNumber: string | null;
  holderName: string | null;
  status: "PENDING_UPLOAD" | "UNDER_REVIEW" | "VERIFIED_ACTIVE" | "EXPIRED" | "REJECTED";
  isSandboxed: boolean;
  issueDate: string | null;
  validUntil: string | null;
  documentsCount: number;
  pendingDocuments: string[];
  partnerCredentialsConfigured: boolean;
}

interface DeskStatusResponse {
  success: boolean;
  data: {
    config: {
      id: string;
      entityName: string;
      llpin: string | null;
      operatingMode: "TEST_SANDBOX" | "RESTRICTED_PILOT" | "PRODUCTION_LIVE";
      capabilityTier: "SANDBOX_TEST" | "PARTIAL_DISTRIBUTION" | "FULL_DISTRIBUTION" | "ADVISORY_UPGRADED";
      isMfDistributionActive: boolean;
      isUpstoxEquityActive: boolean;
      isAlpacaUsEquityActive: boolean;
      isCorporateFdActive: boolean;
      isBondDistributionActive: boolean;
      isAiAdvisoryActive: boolean;
      updatedAt: string;
    };
    licenses: DeskLicenseSummary[];
    nextSteps: string[];
  };
}

interface CircuitMetrics {
  provider: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFailures: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastFailureTime?: string | null;
  lastSuccessTime?: string | null;
}

const DESK_METADATA: Record<string, { label: string; regulator: string; subtitle: string; icon: string }> = {
  MFD_AMFI: {
    label: "Mutual Fund Distribution",
    regulator: "AMFI & SEBI",
    subtitle: "Corporate ARN, NISM-Series-V-A, and EUIN governance",
    icon: "📈",
  },
  UPSTOX_BROKER: {
    label: "Domestic Equities & F&O",
    regulator: "SEBI & Exchanges",
    subtitle: "Upstox API v3 Authorised Person (AP) order routing",
    icon: "⚡",
  },
  BONDS_NCDS_DESK: {
    label: "Corporate Bonds & NCDs",
    regulator: "SEBI OBPP & NCS",
    subtitle: "Listed debt, secondary bonds & primary public NCD IPOs",
    icon: "🏛️",
  },
  IRIS_KFINTECH: {
    label: "RTA Hub & Corporate FDs",
    regulator: "SEBI & RBI",
    subtitle: "KFintech IRIS Hub reverse feeds & company deposits",
    icon: "🔄",
  },
  ALPACA_GLOBAL: {
    label: "Cross-Border US Equities",
    regulator: "RBI LRS & FINRA",
    subtitle: "Alpaca Broker Partner API, Form A2 & GST LUT export",
    icon: "🌐",
  },
  SEBI_RIA_ADVISORY: {
    label: "AI Advisory & Model Portfolios",
    regulator: "SEBI IA Regs 2013",
    subtitle: "Fee-only fiduciary advisory & Reg 22 SIDD segregation",
    icon: "🧠",
  },
};

export function DeskLicensingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [selectedDeskForLicense, setSelectedDeskForLicense] = useState<DeskLicenseSummary | null>(null);
  const [licenseInput, setLicenseInput] = useState("");
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

  // Simulation test state
  const [simDeskType, setSimDeskType] = useState<string>("MFD_AMFI");
  const [simSymbol, setSimSymbol] = useState("HDFC-TOP-100-DIR-GROWTH");
  const [simAmount, setSimAmount] = useState<number>(5000);
  const [simResult, setSimResult] = useState<any>(null);

  // Fetch Desks Status
  const { data: statusData, isLoading: isStatusLoading } = useQuery<DeskStatusResponse>({
    queryKey: ["/api/admin/desks/status"],
  });

  // Fetch Partner Circuit Breaker Status
  const { data: circuitData } = useQuery<{ success: boolean; data: Record<string, CircuitMetrics> }>({
    queryKey: ["/api/admin/desks/circuits"],
    refetchInterval: 10000,
  });

  const deskConfig = statusData?.data?.config;
  const licenses = statusData?.data?.licenses || [];
  const nextSteps = statusData?.data?.nextSteps || [];
  const circuits = circuitData?.data || {};

  // Mutation: Toggle Global Operating Mode
  const updateModeMutation = useMutation({
    mutationFn: async (newMode: "TEST_SANDBOX" | "PRODUCTION_LIVE") => {
      return await apiRequest("/api/admin/desks/mode", "POST", { operatingMode: newMode });
    },
    onSuccess: (_, newMode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desks/status"] });
      toast({
        title: "Platform Mode Updated",
        description: `FintekPro is now running in ${newMode} mode.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update operating mode.",
        variant: "destructive",
      });
    },
  });

  // Mutation: Save License Number
  const saveLicenseMutation = useMutation({
    mutationFn: async (params: { deskType: string; licenseNumber: string }) => {
      return await apiRequest("/api/admin/desks/licenses", "POST", {
        deskType: params.deskType,
        licenseNumber: params.licenseNumber,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desks/status"] });
      setIsLicenseDialogOpen(false);
      toast({
        title: "License Saved",
        description: "Statutory license details updated successfully.",
      });
    },
  });

  // Mutation: Fast Upload & Verify Document (Test/Pilot quick action)
  const uploadAndVerifyDocMutation = useMutation({
    mutationFn: async (params: { licenseId: string; docType: string }) => {
      const uploadRes = await apiRequest(`/api/admin/desks/licenses/${params.licenseId}/documents`, "POST", {
        documentType: params.docType,
        fileName: `${params.docType.toLowerCase()}_verified.pdf`,
        fileUrl: `/vault/${params.docType.toLowerCase()}.pdf`,
        fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      });

      const docId = uploadRes?.data?.documentId;
      if (docId) {
        await apiRequest(`/api/admin/desks/documents/${docId}/verify`, "POST", {
          status: "APPROVED",
          verificationNotes: "Approved by Admin Compliance Console",
        });
      }
      return uploadRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desks/status"] });
      toast({
        title: "Document Verified",
        description: "Mandatory document approved. Capability tier upgraded.",
      });
    },
  });

  // Mutation: Reset Circuit
  const resetCircuitMutation = useMutation({
    mutationFn: async (provider: string) => {
      return await apiRequest(`/api/admin/desks/circuits/${provider}/reset`, "POST");
    },
    onSuccess: (_, provider) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/desks/circuits"] });
      toast({
        title: "Circuit Reset",
        description: `Circuit breaker for ${provider} has been reset to CLOSED.`,
      });
    },
  });

  // Mutation: Run Simulated Order
  const simulateOrderMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/desks/simulate-order", "POST", {
        deskType: simDeskType,
        symbolOrScheme: simSymbol,
        amount: simAmount,
        action: "BUY",
      });
    },
    onSuccess: (res) => {
      setSimResult(res?.data || res);
      toast({
        title: "Simulation Successful",
        description: `Test order ${res?.data?.simulatedOrderId || ""} executed safely.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Simulation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isStatusLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isLive = deskConfig?.operatingMode === "PRODUCTION_LIVE";

  return (
    <div className="space-y-6">
      {/* ── Top Executive Banner & Mode Switch ── */}
      <Card className="border-2 border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {deskConfig?.entityName || "FintekPro Financial Services LLP"}
                </h2>
                <Badge variant="outline" className="font-mono text-xs">
                  LLPIN: {deskConfig?.llpin || "AAM-1234"}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Statutory License Activator & Dual-Mode Execution Gateway (SEBI • AMFI • RBI LRS • OBPP)
              </p>
            </div>

            {/* Capability Tier & Mode Switcher */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Tier</div>
                <Badge
                  className={
                    deskConfig?.capabilityTier === "ADVISORY_UPGRADED"
                      ? "bg-purple-600 text-white font-semibold"
                      : deskConfig?.capabilityTier === "FULL_DISTRIBUTION"
                        ? "bg-emerald-600 text-white font-semibold"
                        : deskConfig?.capabilityTier === "PARTIAL_DISTRIBUTION"
                          ? "bg-blue-600 text-white font-semibold"
                          : "bg-amber-600 text-white font-semibold"
                  }
                >
                  {deskConfig?.capabilityTier || "SANDBOX_TEST"}
                </Badge>
              </div>

              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    {isLive ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        PRODUCTION LIVE
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        TEST SANDBOX
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isLive ? "Live Partner API Routing" : "Safe Mock Simulation"}
                  </div>
                </div>
                <Switch
                  checked={isLive}
                  onCheckedChange={(checked) => {
                    updateModeMutation.mutate(checked ? "PRODUCTION_LIVE" : "TEST_SANDBOX");
                  }}
                  disabled={updateModeMutation.isPending}
                />
              </div>
            </div>
          </div>

          {/* Next Steps / Guidance Banner */}
          {nextSteps.length > 0 && (
            <div className="mt-5 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-semibold">Statutory Capability Next Steps:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {nextSteps.slice(0, 3).map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 6 Statutory Desks Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Statutory Desk Licensing & Capability Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Upload mandatory regulatory certificates to progressively unlock live distribution & advisory tracks.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/desks/status"] })}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Desks
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {licenses.map((lic) => {
            const meta = DESK_METADATA[lic.deskType] || {
              label: lic.deskType,
              regulator: "Statutory Authority",
              subtitle: "Operational Gateway",
              icon: "📑",
            };

            const isVerified = lic.status === "VERIFIED_ACTIVE";

            return (
              <Card
                key={lic.id}
                className={`border transition-all duration-200 ${
                  isVerified
                    ? "border-emerald-300 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-card hover:border-slate-300"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{meta.icon}</span>
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {meta.label}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {meta.regulator} • {lic.deskType}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={isVerified ? "default" : "secondary"}
                      className={
                        isVerified
                          ? "bg-emerald-600 text-white text-[11px]"
                          : lic.status === "UNDER_REVIEW"
                            ? "bg-blue-600 text-white text-[11px]"
                            : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 text-[11px]"
                      }
                    >
                      {lic.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-1">{meta.subtitle}</p>

                  {/* License Number Row */}
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">License Number</div>
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {lic.licenseNumber || "Not Configured"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedDeskForLicense(lic);
                        setLicenseInput(lic.licenseNumber || "");
                        setIsLicenseDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Mandatory Documents Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>Mandatory Verification Documents</span>
                      <span>{lic.documentsCount} Approved</span>
                    </div>

                    {lic.pendingDocuments.length === 0 ? (
                      <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>All mandatory documents approved</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {lic.pendingDocuments.map((docType) => (
                          <div
                            key={docType}
                            className="p-2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
                              {docType}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2"
                              disabled={uploadAndVerifyDocMutation.isPending}
                              onClick={() => {
                                uploadAndVerifyDocMutation.mutate({
                                  licenseId: lic.id,
                                  docType,
                                });
                              }}
                            >
                              <UploadCloud className="w-3 h-3 mr-1" />
                              Verify
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status Footer */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Sandbox Bypass:</span>
                    <Badge variant={lic.isSandboxed ? "outline" : "default"}>
                      {lic.isSandboxed ? "Sandboxed" : "Live Enabled"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Partner Circuit Breaker & Health Monitor ── */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-base font-bold">Partner API Circuit Breaker Surveillance</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Sub-150ms Stale-While-Revalidate Guardrail
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Guarantees zero downtime by automatically opening circuits and serving cached fallbacks if Upstox, IRIS, or Alpaca fail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.entries(circuits).map(([provider, metric]) => {
              const isClosed = metric.state === "CLOSED";
              return (
                <div
                  key={provider}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{provider}</span>
                    <Badge
                      className={
                        isClosed
                          ? "bg-emerald-600 text-white"
                          : metric.state === "HALF_OPEN"
                            ? "bg-amber-600 text-white"
                            : "bg-red-600 text-white"
                      }
                    >
                      {metric.state}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>Calls: {metric.totalCalls}</div>
                    <div>Failures: {metric.consecutiveFailures}</div>
                  </div>
                  {!isClosed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs"
                      onClick={() => resetCircuitMutation.mutate(provider)}
                    >
                      Reset Circuit
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Sandbox Order Simulator Console ── */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white">Sandbox Order Simulator & Pre-Flight Probe</CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-300">
            Execute safe simulated orders under test conditions to verify partner desk readiness without real capital exposure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-slate-300 font-semibold mb-1 block">Desk Target</span>
              <Select value={simDeskType} onValueChange={setSimDeskType}>
                <SelectTrigger className="bg-slate-800/80 border-slate-700 text-white text-xs h-9">
                  <SelectValue placeholder="Select Desk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MFD_AMFI">MFD_AMFI (Mutual Funds)</SelectItem>
                  <SelectItem value="UPSTOX_BROKER">UPSTOX_BROKER (Equities)</SelectItem>
                  <SelectItem value="BONDS_NCDS_DESK">BONDS_NCDS_DESK (Bonds & NCDs)</SelectItem>
                  <SelectItem value="ALPACA_GLOBAL">ALPACA_GLOBAL (US Equities)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <span className="text-[11px] text-slate-300 font-semibold mb-1 block">Symbol / Scheme Code</span>
              <Input
                value={simSymbol}
                onChange={(e) => setSimSymbol(e.target.value)}
                className="bg-slate-800/80 border-slate-700 text-white text-xs h-9 font-mono"
              />
            </div>

            <div>
              <span className="text-[11px] text-slate-300 font-semibold mb-1 block">Amount (INR)</span>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="bg-slate-800/80 border-slate-700 text-white text-xs h-9 font-mono"
                />
                <Button
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 h-9 text-xs"
                  onClick={() => simulateOrderMutation.mutate()}
                  disabled={simulateOrderMutation.isPending}
                >
                  {simulateOrderMutation.isPending ? "Executing..." : "Probe"}
                </Button>
              </div>
            </div>
          </div>

          {/* Simulation Output Display */}
          {simResult && (
            <div className="p-3 rounded-lg bg-black/40 border border-indigo-500/30 text-xs font-mono space-y-1">
              <div className="text-emerald-400 font-bold">
                ✓ Order Placed: {simResult.simulatedOrderId}
              </div>
              <div className="text-slate-300">Desk: {simResult.deskType} • Fill: ₹{simResult.executionSnapshot?.mockExchangeResponse?.simulatedFillPrice}</div>
              <div className="text-slate-400 text-[11px]">{simResult.details}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog: Edit License Details ── */}
      <Dialog open={isLicenseDialogOpen} onOpenChange={setIsLicenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Statutory License Details</DialogTitle>
            <DialogDescription className="text-xs">
              Enter official license number for {selectedDeskForLicense?.deskType} (e.g. Corporate ARN, AP ID, Alpaca ID).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div>
              <span className="font-semibold block mb-1">License Registration Number</span>
              <Input
                placeholder="e.g. ARN-182394, AP-UPSTOX-001"
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLicenseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDeskForLicense) {
                  saveLicenseMutation.mutate({
                    deskType: selectedDeskForLicense.deskType,
                    licenseNumber: licenseInput,
                  });
                }
              }}
              disabled={saveLicenseMutation.isPending}
            >
              {saveLicenseMutation.isPending ? "Saving..." : "Save License"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
