import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle,
  Building2,
  User,
  Shield,
  Calendar,
  ChevronRight,
  SkipForward,
  Mic,
  Activity,
  History,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Copy,
  Smartphone,
  Check,
  Zap,
} from "lucide-react";

export interface QueueProspect {
  id: string;
  companyName: string;
  contactName?: string | null;
  contactDesignation?: string | null;
  phone: string;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  leadQuality?: string | null;
  leadScore?: number | null;
  compositeScore?: string | number | null;
  status?: string | null;
  notes?: string | null;
  investableSurplus?: string | number | null;
  industrySegment?: string | null;
}

interface AutoDialerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLead?: QueueProspect | null;
  isQueueMode?: boolean;
}

export function AutoDialerModal({
  isOpen,
  onClose,
  initialLead,
  isQueueMode = false,
}: AutoDialerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Call status state machine: idle -> in_call -> ended
  const [callState, setCallState] = useState<"idle" | "in_call" | "ended">("idle");
  const [callSeconds, setCallSeconds] = useState(0);
  const [activeCallRecord, setActiveCallRecord] = useState<any>(null);
  const [queueIndex, setQueueIndex] = useState(0);
  const [copiedNumber, setCopiedNumber] = useState(false);

  // Disposition form state
  const [disposition, setDisposition] = useState<string>("interested");
  const [dispositionNotes, setDispositionNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Progressive Queue
  const { data: queueResponse } = useQuery<{
    data: QueueProspect[];
    total: number;
  }>({
    queryKey: ["/api/dialer/queue"],
    enabled: isOpen && isQueueMode,
  });

  // Fetch Dialer Stats
  const { data: statsResponse } = useQuery<{
    data: {
      today: {
        totalCalls: number;
        completedCalls: number;
        formattedTalkTime: string;
        convertedCount: number;
        connectionRate: number;
      };
      isExotelConfigured: boolean;
      virtualNumber: string;
    };
  }>({
    queryKey: ["/api/dialer/stats"],
    enabled: isOpen,
  });

  // Fetch Call History
  const { data: historyResponse } = useQuery<{ data: any[] }>({
    queryKey: ["/api/dialer/history"],
    enabled: isOpen,
  });

  const queue = queueResponse?.data || [];
  const currentLead: QueueProspect | null = isQueueMode
    ? queue[queueIndex] || null
    : initialLead || null;

  // Clean phone number helper
  const cleanPhone = (phone: string | undefined): string => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return digits.startsWith("+") ? digits : `+91${digits}`;
  };

  // Timer logic for active call
  useEffect(() => {
    if (callState === "in_call") {
      timerRef.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Reset state when closing or changing lead
  useEffect(() => {
    if (!isOpen) {
      setCallState("idle");
      setCallSeconds(0);
      setActiveCallRecord(null);
      setDisposition("interested");
      setDispositionNotes("");
      setFollowUpDate("");
      setCopiedNumber(false);
    }
  }, [isOpen]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 1. Mutation: Initiate Zero-Cost Device SIM Call
  const initiateSimCallMutation = useMutation({
    mutationFn: async () => {
      if (!currentLead) throw new Error("No active lead selected");
      const normalizedPhone = cleanPhone(currentLead.phone);

      const res = await apiRequest("/api/dialer/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectLeadId: currentLead.id,
          prospectName: currentLead.contactName || currentLead.companyName,
          prospectPhone: normalizedPhone,
          dialerMode: "native_sim",
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveCallRecord(data.data);
      setCallState("in_call");

      // Trigger native device dialer intent
      const normalizedPhone = cleanPhone(currentLead?.phone);
      window.location.href = `tel:${normalizedPhone}`;

      toast({
        title: "Dialing via Device SIM...",
        description: `Native phone dialer launched for ${currentLead?.contactName || currentLead?.companyName}. Call timer started.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Could not log call",
        description: err.message || "Failed to initialize call session",
        variant: "destructive",
      });
    },
  });

  // 2. Mutation: Save Call Disposition & CRM Update
  const saveDispositionMutation = useMutation({
    mutationFn: async () => {
      if (!activeCallRecord?.id) throw new Error("No active call log found");
      const res = await apiRequest("/api/dialer/disposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callLogId: activeCallRecord.id,
          disposition,
          notes: dispositionNotes,
          followUpDate: followUpDate || undefined,
          duration: callSeconds,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dialer/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dialer/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dialer/queue"] });

      toast({
        title: "Call Logged Successfully",
        description: `Outcome '${disposition.replace("_", " ")}' (${formatTimer(callSeconds)}) logged to CRM.`,
      });

      if (isQueueMode && queueIndex < queue.length - 1) {
        // Automatically advance to next prospect in queue
        setQueueIndex((prev) => prev + 1);
        setCallState("idle");
        setCallSeconds(0);
        setActiveCallRecord(null);
        setDisposition("interested");
        setDispositionNotes("");
        setFollowUpDate("");
      } else {
        onClose();
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save disposition",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleEndCall = () => {
    setCallState("ended");
    toast({
      title: "Call Finished",
      description: `Talk time: ${formatTimer(callSeconds)}. Select an outcome to update your pipeline.`,
    });
  };

  const handleSkipLead = () => {
    if (queueIndex < queue.length - 1) {
      setQueueIndex((prev) => prev + 1);
      setCallState("idle");
      setCallSeconds(0);
      setActiveCallRecord(null);
    } else {
      toast({ title: "End of Queue", description: "You have reviewed all leads in today's list." });
    }
  };

  const handleCopyPhone = () => {
    if (!currentLead?.phone) return;
    navigator.clipboard.writeText(cleanPhone(currentLead.phone));
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
    toast({ title: "Phone number copied", description: cleanPhone(currentLead.phone) });
  };

  const getWhatsAppUrl = (phone: string, name: string) => {
    const cleanDigits = phone.replace(/\D/g, "");
    const formatted = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const text = encodeURIComponent(
      `Hello ${name}, this is from FintekPro Wealth Advisory regarding your investment portfolio. Would you have 5 minutes to discuss?`
    );
    return `https://wa.me/${formatted}?text=${text}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-3xl bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-hidden shadow-2xl"
        data-testid="auto-dialer-modal"
      >
        <DialogHeader className="p-6 pb-4 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  FintekPro Auto-Dialer
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                    Native SIM (100% Free / ₹0 Telephony)
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>Uses your device cellular plan</span>
                  <span>•</span>
                  <span>Instant CRM Sync & Call Dispositions</span>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Metrics */}
            {statsResponse?.data.today && (
              <div className="hidden sm:flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400">Calls Today:</span>{" "}
                  <span className="font-semibold text-white">{statsResponse.data.today.totalCalls}</span>
                </div>
                <div className="h-3 w-[1px] bg-slate-700" />
                <div>
                  <span className="text-slate-400">Talk Time:</span>{" "}
                  <span className="font-semibold text-emerald-400">
                    {statsResponse.data.today.formattedTalkTime}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="dialer" className="w-full">
          <div className="px-6 border-b border-slate-800 bg-slate-900/40">
            <TabsList className="bg-transparent border-0 p-0 h-11 gap-6">
              <TabsTrigger
                value="dialer"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-1 text-slate-400 data-[state=active]:text-white font-medium"
              >
                <Activity className="h-4 w-4 mr-2" />
                Active Dialer
                {isQueueMode && queue.length > 0 && (
                  <Badge className="ml-2 bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/40 text-[10px] px-1.5 py-0 border-0">
                    {queueIndex + 1}/{queue.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none px-1 text-slate-400 data-[state=active]:text-white font-medium"
              >
                <History className="h-4 w-4 mr-2" />
                Call Activity History
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dialer" className="p-6 pt-4 focus-visible:outline-none">
            {currentLead ? (
              <div className="space-y-6">
                {/* ── Active Prospect Card ── */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 flex gap-2">
                    {currentLead.leadQuality && (
                      <Badge
                        className={
                          currentLead.leadQuality === "hot"
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        }
                      >
                        {currentLead.leadQuality.toUpperCase()} LEAD
                      </Badge>
                    )}
                    {currentLead.leadScore !== undefined && currentLead.leadScore !== null && (
                      <Badge variant="outline" className="border-slate-700 text-slate-300">
                        Score: {currentLead.leadScore}/100
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 pr-24">
                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {currentLead.companyName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400 mt-1">
                        {currentLead.contactName && (
                          <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            {currentLead.contactName}
                            {currentLead.contactDesignation && (
                              <span className="text-xs text-slate-400 font-normal">
                                ({currentLead.contactDesignation})
                              </span>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-mono text-emerald-400 font-semibold">
                          <Phone className="h-3.5 w-3.5 mr-0.5" />
                          {cleanPhone(currentLead.phone)}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyPhone}
                          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 p-0.5 rounded hover:bg-slate-800 transition"
                          title="Copy Number"
                        >
                          {copiedNumber ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>

                      {currentLead.investableSurplus && (
                        <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                          <span className="text-slate-500">Est. Investable Surplus:</span>
                          <span className="font-semibold text-white">
                            ₹{Number(currentLead.investableSurplus).toLocaleString("en-IN")}
                          </span>
                          {currentLead.city && (
                            <>
                              <span>•</span>
                              <span>📍 {currentLead.city}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Call Action & Live Status Stage ── */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                  {callState === "idle" && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-center sm:text-left">
                        <h4 className="font-semibold text-white text-base flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-400" />
                          One-Click Mobile SIM Dial
                        </h4>
                        <p className="text-xs text-slate-400">
                          Clicking will launch your phone's dialer via your SIM card. 100% free of cloud carrier charges.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* WhatsApp Direct Option */}
                        <a
                          href={getWhatsAppUrl(currentLead.phone, currentLead.contactName || currentLead.companyName)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-2 text-xs font-semibold transition"
                        >
                          <MessageCircle className="h-4 w-4 mr-1.5 text-emerald-400" />
                          WhatsApp
                        </a>

                        {isQueueMode && (
                          <Button
                            variant="outline"
                            onClick={handleSkipLead}
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                            data-testid="btn-skip-lead"
                          >
                            <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                            Skip
                          </Button>
                        )}

                        <Button
                          onClick={() => initiateSimCallMutation.mutate()}
                          disabled={initiateSimCallMutation.isPending}
                          className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 shadow-lg shadow-emerald-900/30"
                          data-testid="btn-initiate-call"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {initiateSimCallMutation.isPending ? "Opening Phone..." : "Dial on Mobile / SIM"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {callState === "in_call" && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
                          <div className="relative p-2.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <Mic className="h-5 w-5" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                            <p className="font-bold text-white text-base">Active Call in Progress</p>
                            <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[10px]">
                              Native SIM Mode
                            </Badge>
                          </div>
                          <p className="text-sm text-emerald-400 font-mono font-bold tracking-wider">
                            Elapsed Talk Time: {formatTimer(callSeconds)}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="destructive"
                        onClick={handleEndCall}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-6 shadow-lg shadow-rose-950/40"
                        data-testid="btn-end-call"
                      >
                        <PhoneOff className="h-4 w-4 mr-2" />
                        Hang Up & Log Outcome
                      </Button>
                    </div>
                  )}

                  {callState === "ended" && (
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-medium">
                          Call Complete • Duration: {formatTimer(callSeconds)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => initiateSimCallMutation.mutate()}
                        className="border-slate-700 text-slate-300 text-xs"
                      >
                        <PhoneCall className="h-3 w-3 mr-1" /> Redial
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Disposition & CRM Sync Form ── */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      Advisor Call Outcome & Dispositions
                    </h4>
                    {isQueueMode && (
                      <span className="text-xs text-slate-400 font-mono">
                        Queue Lead #{queueIndex + 1} of {queue.length}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Call Outcome / Disposition</Label>
                      <Select value={disposition} onValueChange={setDisposition}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="interested">Interested / High Intent</SelectItem>
                          <SelectItem value="meeting_fixed">Meeting Fixed (Schedule Advisory)</SelectItem>
                          <SelectItem value="callback_requested">Callback Requested</SelectItem>
                          <SelectItem value="not_interested">Not Interested</SelectItem>
                          <SelectItem value="wrong_number">Wrong Number / Invalid</SelectItem>
                          <SelectItem value="dnd">DND Requested (TRAI Block)</SelectItem>
                          <SelectItem value="unreachable">Unreachable / Busy</SelectItem>
                          <SelectItem value="converted">Direct Onboarding Converted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">Next Follow-Up Date & Time</Label>
                      <Input
                        type="datetime-local"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Call Summary & Client Discussion Notes</Label>
                    <Textarea
                      placeholder="e.g. Discussed mutual fund portfolio review. Client requested a tax-saving advisory proposal over WhatsApp."
                      value={dispositionNotes}
                      onChange={(e) => setDispositionNotes(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs h-20"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      Auto-syncs with CRM Timeline & Lead Stage
                    </div>

                    <Button
                      onClick={() => saveDispositionMutation.mutate()}
                      disabled={saveDispositionMutation.isPending || !activeCallRecord}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5"
                      data-testid="btn-save-disposition"
                    >
                      {saveDispositionMutation.isPending
                        ? "Saving..."
                        : isQueueMode
                        ? "Save & Dial Next Lead ➔"
                        : "Save Disposition & Finish"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
                <p className="font-semibold text-white">No Active Prospect Found</p>
                <p className="text-xs max-w-sm mx-auto text-slate-400">
                  Select a prospect from your Lead Pipeline or click "Auto-Dialer Queue" to start your outreach.
                </p>
                <Button variant="outline" onClick={onClose} className="border-slate-800 text-slate-300">
                  Close
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── Call History Tab ── */}
          <TabsContent value="history" className="p-6 pt-2 focus-visible:outline-none">
            <ScrollArea className="h-[360px] pr-3">
              {historyResponse?.data && historyResponse.data.length > 0 ? (
                <div className="space-y-2.5">
                  {historyResponse.data.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{log.prospectName}</span>
                          <span className="font-mono text-slate-400">({log.prospectPhone})</span>
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-400 bg-emerald-500/5 text-[10px]"
                          >
                            {log.dialerMode === "native_sim" ? "Device SIM" : "Cloud Call"}
                          </Badge>
                        </div>
                        <div className="text-slate-400 flex items-center gap-2">
                          <span>Disposition: <strong className="text-slate-200">{log.disposition || "Logged"}</strong></span>
                          <span>•</span>
                          <span>Duration: {log.duration}s</span>
                          <span>•</span>
                          <span>{new Date(log.createdAt).toLocaleString("en-IN")}</span>
                        </div>
                        {log.dispositionNotes && (
                          <p className="text-slate-300 italic pt-0.5">"{log.dispositionNotes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No calls logged today yet.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
