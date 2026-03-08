import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, Circle, ArrowRight, ArrowLeft, ShieldCheck, Loader2,
  User, Briefcase, FileText, Building2, ScrollText, Eye, AlertTriangle,
  BadgeCheck, Upload, CreditCard, Award, Info, Clock, Pencil, ChevronLeft
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Empanelment {
  id: string;
  status: string;
  current_step: number;
  pan_verified: boolean;
  pan_number: string | null;
  pan_name: string | null;
  aadhaar_verified: boolean;
  aadhaar_last4: string | null;
  services_offered: string[];
  arn_code: string | null;
  arn_expiry_date: string | null;
  euin_number: string | null;
  nism_certificate_number: string | null;
  nism_certificate_type: string | null;
  nism_expiry_date: string | null;
  ria_number: string | null;
  posp_number: string | null;
  posp_insurer: string | null;
  dsa_code: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_holder_name: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_verified: boolean;
  doc_nism_certificate: string | null;
  doc_graduation_certificate: string | null;
  doc_pan_card: string | null;
  doc_cancelled_cheque: string | null;
  doc_photo: string | null;
  pmla_declaration_signed: boolean;
  criminal_record_declaration: boolean;
  fatca_declaration_signed: boolean;
  code_of_conduct_accepted: boolean;
  anti_mis_selling_accepted: boolean;
  submitted_at: string | null;
  rejection_reason: string | null;
  approval_notes: string | null;
}

const STEPS = [
  { number: 1, label: "Identity", icon: User },
  { number: 2, label: "Services", icon: Briefcase },
  { number: 3, label: "Credentials", icon: Award },
  { number: 4, label: "Bank A/C", icon: Building2 },
  { number: 5, label: "Documents", icon: FileText },
  { number: 6, label: "Declarations", icon: ScrollText },
  { number: 7, label: "Review", icon: Eye },
];

const SERVICE_OPTIONS = [
  { id: "mutual_fund", label: "Mutual Fund Distribution", subtitle: "ARN + NISM V-A required", icon: "📈" },
  { id: "insurance", label: "Insurance Distribution", subtitle: "POSP license required", icon: "🛡️" },
  { id: "loans", label: "Loan / DSA", subtitle: "DSA code required", icon: "🏦" },
  { id: "ria", label: "Investment Advisory (RIA)", subtitle: "SEBI RIA number required", icon: "💼" },
  { id: "stocks", label: "Stock Broking Support", subtitle: "NISM XII required", icon: "📊" },
];

const NISM_TYPES = [
  { value: "V-A", label: "Series V-A — MF Distributors" },
  { value: "X-A", label: "Series X-A — Investment Adviser (Level 1)" },
  { value: "X-B", label: "Series X-B — Investment Adviser (Level 2)" },
  { value: "XV", label: "Series XV — Research Analyst" },
  { value: "XII", label: "Series XII — Securities Operations & Risk Management" },
  { value: "VIII", label: "Series VIII — Equity Derivatives" },
  { value: "other", label: "Other NISM Certification" },
];

function StepIndicator({ current, maxReached }: { current: number; maxReached: number }) {
  return (
    <div className="flex items-center justify-between w-full mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const done = step.number < current;
        const active = step.number === current;
        const reachable = step.number <= maxReached;
        const Icon = step.icon;
        return (
          <div key={step.number} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done ? "bg-green-500 border-green-500 text-white"
                : active ? "bg-blue-600 border-blue-600 text-white"
                : reachable ? "bg-background border-blue-300 text-blue-600"
                : "bg-muted border-muted-foreground/20 text-muted-foreground"
              }`}>
                {done ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-blue-600" : done ? "text-green-600" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 transition-all ${done ? "bg-green-400" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AgentKycEmpanelment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [editStep, setEditStep] = useState<number | null>(null);

  // Step 1
  const [panNumber, setPanNumber] = useState("");
  const [panVerifying, setPanVerifying] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panName, setPanName] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarLast4, setAadhaarLast4] = useState("");

  // Step 2
  const [servicesOffered, setServicesOffered] = useState<string[]>([]);

  // Step 3
  const [arnCode, setArnCode] = useState("");
  const [arnExpiry, setArnExpiry] = useState("");
  const [euinNumber, setEuinNumber] = useState("");
  const [nismCertNum, setNismCertNum] = useState("");
  const [nismCertType, setNismCertType] = useState("");
  const [nismExpiry, setNismExpiry] = useState("");
  const [riaNumber, setRiaNumber] = useState("");
  const [pospNumber, setPospNumber] = useState("");
  const [pospInsurer, setPospInsurer] = useState("");
  const [dsaCode, setDsaCode] = useState("");

  // Step 4
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankVerifying, setBankVerifying] = useState(false);
  const [bankVerified, setBankVerified] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankMsg, setBankMsg] = useState("");

  // Step 5 — document names (simulated upload)
  const [docNism, setDocNism] = useState("");
  const [docGrad, setDocGrad] = useState("");
  const [docPan, setDocPan] = useState("");
  const [docCheque, setDocCheque] = useState("");
  const [docPhoto, setDocPhoto] = useState("");

  // Step 6
  const [pmla, setPmla] = useState(false);
  const [criminal, setCriminal] = useState(false);
  const [fatca, setFatca] = useState(false);
  const [coc, setCoc] = useState(false);
  const [antiMis, setAntiMis] = useState(false);

  // Fetch existing empanelment record
  const { data: empanelmentData, isLoading } = useQuery<{ success: boolean; empanelment: Empanelment }>({
    queryKey: ["/api/agent/empanelment"],
  });

  // Hydrate form from existing record
  useEffect(() => {
    const emp = empanelmentData?.empanelment;
    if (!emp) return;
    setStep(Math.max(1, emp.current_step || 1));
    if (emp.pan_verified) { setPanVerified(true); setPanNumber(emp.pan_number || ""); setPanName(emp.pan_name || ""); }
    if (emp.aadhaar_verified) { setAadhaarVerified(true); setAadhaarLast4(emp.aadhaar_last4 || ""); }
    if (emp.services_offered?.length) setServicesOffered(emp.services_offered);
    setArnCode(emp.arn_code || ""); setArnExpiry(emp.arn_expiry_date || "");
    setEuinNumber(emp.euin_number || ""); setNismCertNum(emp.nism_certificate_number || "");
    setNismCertType(emp.nism_certificate_type || ""); setNismExpiry(emp.nism_expiry_date || "");
    setRiaNumber(emp.ria_number || ""); setPospNumber(emp.posp_number || "");
    setPospInsurer(emp.posp_insurer || ""); setDsaCode(emp.dsa_code || "");
    setBankAccountNumber(emp.bank_account_number || ""); setBankIfsc(emp.bank_ifsc || "");
    setBankHolderName(emp.bank_account_holder_name || ""); setBankName(emp.bank_name || "");
    setBankBranch(emp.bank_branch || ""); setBankVerified(emp.bank_verified || false);
    if (emp.bank_verified && emp.bank_name) setBankMsg(`Verified ✓ (${emp.bank_name}${emp.bank_branch ? " – " + emp.bank_branch : ""})`);
    setDocNism(emp.doc_nism_certificate || ""); setDocGrad(emp.doc_graduation_certificate || "");
    setDocPan(emp.doc_pan_card || ""); setDocCheque(emp.doc_cancelled_cheque || ""); setDocPhoto(emp.doc_photo || "");
    setPmla(emp.pmla_declaration_signed || false); setCriminal(emp.criminal_record_declaration || false);
    setFatca(emp.fatca_declaration_signed || false); setCoc(emp.code_of_conduct_accepted || false);
    setAntiMis(emp.anti_mis_selling_accepted || false);
  }, [empanelmentData]);

  const saveMutation = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: string; body: object }) =>
      apiRequest(endpoint, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/agent/empanelment"] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("/api/agent/empanelment/submit", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/empanelment"] });
      toast({ title: "Application Submitted!", description: "Admin will review within 2–3 business days." });
    },
    onError: (err: any) => toast({ title: "Submission failed", description: err.message, variant: "destructive" }),
  });

  // ── PAN Verification ──────────────────────────────────────────────────────
  async function verifyPAN() {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNumber.trim())) {
      toast({ title: "Invalid PAN", description: "Format: ABCDE1234F", variant: "destructive" }); return;
    }
    setPanVerifying(true);
    try {
      const res = await apiRequest("/api/kyc/verify-pan", { method: "POST", body: JSON.stringify({ panNumber: panNumber.toUpperCase() }) });
      if (res.verified) {
        setPanVerified(true); setPanName(res.name || "");
        toast({ title: "PAN Verified ✓", description: `Registered name: ${res.name || "N/A"}` });
      } else {
        toast({ title: "PAN not verified", description: res.message || "PAN could not be verified", variant: "destructive" });
      }
    } catch {
      toast({ title: "PAN verification failed", description: "Network error. Try again.", variant: "destructive" });
    }
    setPanVerifying(false);
  }

  // ── Aadhaar OTP (simulated for sandbox) ──────────────────────────────────
  async function sendAadhaarOtp() {
    if (aadhaarNumber.length !== 12) { toast({ title: "Enter 12-digit Aadhaar number", variant: "destructive" }); return; }
    setAadhaarOtpSent(true);
    toast({ title: "OTP Sent", description: `OTP sent to mobile linked with Aadhaar ****${aadhaarNumber.slice(-4)}` });
  }

  async function verifyAadhaarOtp() {
    if (aadhaarOtp.length !== 6) { toast({ title: "Enter 6-digit OTP", variant: "destructive" }); return; }
    // In sandbox always accept 123456
    const isValid = aadhaarOtp === "123456" || aadhaarOtp.length === 6;
    if (isValid) {
      setAadhaarVerified(true); setAadhaarLast4(aadhaarNumber.slice(-4));
      toast({ title: "Aadhaar Verified ✓", description: `Identity confirmed (****${aadhaarNumber.slice(-4)})` });
    } else {
      toast({ title: "Invalid OTP", description: "Please enter the correct OTP", variant: "destructive" });
    }
  }

  // ── Bank Penny Drop ───────────────────────────────────────────────────────
  async function verifyBank() {
    if (!bankAccountNumber || !bankIfsc || !bankHolderName) {
      toast({ title: "Fill all bank fields", variant: "destructive" }); return;
    }
    setBankVerifying(true); setBankMsg("Initiating penny drop verification…");
    try {
      const res = await apiRequest("/api/agent/empanelment/step/4/verify-bank", {
        method: "POST",
        body: JSON.stringify({ accountNumber: bankAccountNumber, ifscCode: bankIfsc, accountHolderName: bankHolderName }),
      });
      setBankVerified(res.verified || false);
      setBankName(res.bankName || ""); setBankBranch(res.bankBranch || "");
      setBankMsg(res.message || "");
      if (res.verified) {
        toast({ title: "Bank Account Verified ✓", description: res.message });
      } else {
        toast({ title: "Verification failed", description: res.message, variant: "destructive" });
      }
    } catch (err: any) {
      setBankMsg("Verification failed. Try again.");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setBankVerifying(false);
  }

  // ── Step save handlers ────────────────────────────────────────────────────
  function saveStep1() {
    if (!panVerified) { toast({ title: "PAN verification required", variant: "destructive" }); return; }
    saveMutation.mutate({ endpoint: "/api/agent/empanelment/step/1", body: { panVerified, panNumber, panName, aadhaarVerified, aadhaarLast4 } });
    setStep(2);
  }

  function saveStep2() {
    if (!servicesOffered.length) { toast({ title: "Select at least one service", variant: "destructive" }); return; }
    saveMutation.mutate({ endpoint: "/api/agent/empanelment/step/2", body: { servicesOffered } });
    setStep(3);
  }

  function saveStep3() {
    if (servicesOffered.includes("mutual_fund") && !arnCode) {
      toast({ title: "ARN code required for MF distribution", variant: "destructive" }); return;
    }
    if (servicesOffered.includes("ria") && !riaNumber) {
      toast({ title: "SEBI RIA number required", variant: "destructive" }); return;
    }
    saveMutation.mutate({ endpoint: "/api/agent/empanelment/step/3", body: { arnCode, arnExpiryDate: arnExpiry, euinNumber, nismCertificateNumber: nismCertNum, nismCertificateType: nismCertType, nismExpiryDate: nismExpiry, riaNumber, pospNumber, pospInsurer, dsaCode } });
    setStep(4);
  }

  function saveStep4() {
    if (!bankVerified) { toast({ title: "Bank account must be verified via penny drop", variant: "destructive" }); return; }
    setStep(5);
  }

  function saveStep5() {
    saveMutation.mutate({ endpoint: "/api/agent/empanelment/step/5", body: { docNismCertificate: docNism, docGraduationCertificate: docGrad, docPanCard: docPan, docCancelledCheque: docCheque, docPhoto } });
    setStep(6);
  }

  function saveStep6() {
    if (!pmla || !fatca || !coc || !antiMis) {
      toast({ title: "All declarations are mandatory", description: "Please check all boxes to proceed", variant: "destructive" }); return;
    }
    saveMutation.mutate({ endpoint: "/api/agent/empanelment/step/6", body: { pmlaDeclarationSigned: pmla, criminalRecordDeclaration: criminal, fatcaDeclarationSigned: fatca, codeOfConductAccepted: coc, antiMisSellingAccepted: antiMis } });
    setStep(7);
  }

  const emp = empanelmentData?.empanelment;
  const isApproved = emp?.status === "approved";
  const isSubmitted = emp?.status === "submitted" || emp?.status === "under_review";
  const isRejected = emp?.status === "rejected";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Profile View (Approved or Submitted — show saved data with Edit links) ─
  if ((isApproved || isSubmitted) && editStep === null) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-blue-600" />
              My Profile
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Your professional empanelment profile. KYC data is verified and stored securely.
            </p>
          </div>
          {isApproved && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700 flex items-center gap-1 mt-1">
              <BadgeCheck className="h-3.5 w-3.5" /> Approved
            </Badge>
          )}
          {isSubmitted && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-700 flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Under Review
            </Badge>
          )}
        </div>

        {/* Status note */}
        {isSubmitted && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
            Your application is under review. Our compliance team will verify within <strong>2–3 business days</strong>. Editing is paused until approval.
          </div>
        )}
        {isApproved && emp?.approval_notes && (
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200">
            <span className="font-semibold">Admin Notes: </span>{emp.approval_notes}
          </div>
        )}

        {/* ── Identity ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Identity
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(1); setEditStep(1); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">PAN</p><p className="font-medium flex items-center gap-1">{emp?.pan_number} {emp?.pan_verified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
              <div><p className="text-xs text-muted-foreground">Registered Name</p><p className="font-medium">{emp?.pan_name || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Aadhaar</p><p className="font-medium flex items-center gap-1">****{emp?.aadhaar_last4 || "—"} {emp?.aadhaar_verified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* ── Services ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Services
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(2); setEditStep(2); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {(emp?.services_offered || []).map(s => (
                <Badge key={s} variant="secondary">{SERVICE_OPTIONS.find(x => x.id === s)?.label || s}</Badge>
              ))}
              {!(emp?.services_offered?.length) && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>

        {/* ── Credentials ──────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Award className="h-3.5 w-3.5" /> Credentials
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(3); setEditStep(3); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {emp?.arn_code && <div><p className="text-xs text-muted-foreground">ARN</p><p className="font-mono font-medium">{emp.arn_code}</p></div>}
              {emp?.euin_number && <div><p className="text-xs text-muted-foreground">EUIN</p><p className="font-mono font-medium">{emp.euin_number}</p></div>}
              {emp?.nism_certificate_number && <div><p className="text-xs text-muted-foreground">NISM Certificate</p><p className="font-mono font-medium text-xs">{emp.nism_certificate_number}</p></div>}
              {emp?.nism_certificate_type && <div><p className="text-xs text-muted-foreground">NISM Series</p><p className="font-medium">{emp.nism_certificate_type}</p></div>}
              {emp?.ria_number && <div><p className="text-xs text-muted-foreground">SEBI RIA</p><p className="font-mono font-medium">{emp.ria_number}</p></div>}
              {emp?.posp_number && <div><p className="text-xs text-muted-foreground">POSP</p><p className="font-mono font-medium">{emp.posp_number}</p></div>}
              {emp?.dsa_code && <div><p className="text-xs text-muted-foreground">DSA Code</p><p className="font-mono font-medium">{emp.dsa_code}</p></div>}
              {!emp?.arn_code && !emp?.ria_number && !emp?.posp_number && !emp?.dsa_code && <span className="col-span-2 text-sm text-muted-foreground">—</span>}
            </div>
          </CardContent>
        </Card>

        {/* ── Bank Account ─────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" /> Bank Account
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(4); setEditStep(4); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Account Holder</p><p className="font-medium">{emp?.bank_account_holder_name || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Account Number</p><p className="font-mono font-medium">{"*".repeat(Math.max(0, (emp?.bank_account_number?.length || 0) - 4))}{(emp?.bank_account_number || "").slice(-4) || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">IFSC</p><p className="font-mono font-medium">{emp?.bank_ifsc || "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Bank</p><p className="font-medium flex items-center gap-1">{emp?.bank_name || "—"} {emp?.bank_verified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
            </div>
          </CardContent>
        </Card>

        {/* ── Documents ────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Documents
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(5); setEditStep(5); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["NISM Certificate", emp?.doc_nism_certificate],
                ["Graduation Certificate", emp?.doc_graduation_certificate],
                ["PAN Card", emp?.doc_pan_card],
                ["Cancelled Cheque", emp?.doc_cancelled_cheque],
                ["Passport Photo", emp?.doc_photo],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center gap-2">
                  {val ? <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  <span className={`text-xs ${val ? "text-foreground" : "text-muted-foreground"}`}>{label as string}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Declarations ─────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5" /> Declarations
              </CardTitle>
              {isApproved ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs" onClick={() => { setStep(6); setEditStep(6); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Under review</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="grid grid-cols-2 gap-1 text-sm">
              {[
                ["PMLA / AML", emp?.pmla_declaration_signed],
                ["Criminal Record (None)", emp?.criminal_record_declaration],
                ["FATCA / CRS", emp?.fatca_declaration_signed],
                ["Code of Conduct", emp?.code_of_conduct_accepted],
                ["Anti-Mis-Selling", emp?.anti_mis_selling_accepted],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center gap-2">
                  {val ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={val ? "text-foreground" : "text-muted-foreground"}>{label as string}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Rejected State ────────────────────────────────────────────────────────
  const rejectedBanner = isRejected ? (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-red-800 dark:text-red-200">Application Rejected</p>
        <p className="text-sm text-red-700 dark:text-red-300 mt-1">{emp?.rejection_reason || "Your previous submission was rejected. Please review and resubmit."}</p>
        <p className="text-xs text-muted-foreground mt-1">Please correct the issues above and resubmit.</p>
      </div>
    </div>
  ) : null;

  const maxReached = emp?.current_step || 1;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Back to Profile breadcrumb (edit mode only) */}
      {editStep !== null && (
        <button
          onClick={() => setEditStep(null)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium -mb-2"
        >
          <ChevronLeft className="h-4 w-4" /> Back to My Profile
        </button>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          {editStep !== null ? "Edit Profile" : "Complete Your Profile"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {editStep !== null
            ? "Update your details below and save. Click \"Back to My Profile\" when done."
            : "Complete your professional verification to start distributing financial products. All fields are mandatory per SEBI / AMFI / IRDAI / RBI compliance guidelines."}
        </p>
      </div>

      {rejectedBanner}

      {/* Step Indicator */}
      <StepIndicator current={step} maxReached={maxReached} />

      {/* ── STEP 1: Personal Identity ─────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-blue-600" /> Step 1 — Personal Identity Verification</CardTitle>
            <CardDescription>Verify your PAN and Aadhaar. This is your identity as the agent, not your clients'.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PAN */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">PAN Verification</h3>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label>PAN Number *</Label>
                  <Input placeholder="ABCDE1234F" value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())}
                    disabled={panVerified} className="font-mono uppercase" maxLength={10} />
                </div>
                <div className="flex items-end">
                  {panVerified
                    ? <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 h-10 px-3"><CheckCircle className="h-4 w-4" /> Verified</Badge>
                    : <Button onClick={verifyPAN} disabled={panVerifying || panNumber.length !== 10} className="h-10">
                        {panVerifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Verify PAN
                      </Button>
                  }
                </div>
              </div>
              {panVerified && panName && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-300">✓ Registered Name: <strong>{panName}</strong></p>
                </div>
              )}
            </div>

            <Separator />

            {/* Aadhaar */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Aadhaar Verification (OTP)</h3>
              {!aadhaarVerified ? (
                <>
                  <div className="space-y-1">
                    <Label>Aadhaar Number *</Label>
                    <Input placeholder="1234 5678 9012" value={aadhaarNumber}
                      onChange={e => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      disabled={aadhaarOtpSent} className="font-mono" maxLength={12} />
                    <p className="text-xs text-muted-foreground">OTP will be sent to the mobile number linked to your Aadhaar</p>
                  </div>
                  {!aadhaarOtpSent ? (
                    <Button variant="outline" onClick={sendAadhaarOtp} disabled={aadhaarNumber.length !== 12}>
                      Send OTP to Aadhaar-linked Mobile
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Label>Enter 6-digit OTP</Label>
                      <div className="flex gap-3">
                        <Input placeholder="123456" value={aadhaarOtp} onChange={e => setAadhaarOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} className="font-mono w-40" maxLength={6} />
                        <Button onClick={verifyAadhaarOtp} disabled={aadhaarOtp.length !== 6}>Verify OTP</Button>
                        <Button variant="ghost" onClick={() => setAadhaarOtpSent(false)}>Resend</Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">✓ Aadhaar verified — ****{aadhaarLast4}</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">Your PAN and Aadhaar are used only for agent identity verification per SEBI/PMLA requirements. This is separate from your clients' KYC.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={saveStep1} disabled={!panVerified} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 2: Role & Services ──────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-blue-600" /> Step 2 — Role & Services</CardTitle>
            <CardDescription>Select the financial services you will offer. This determines which professional credentials are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {SERVICE_OPTIONS.map(svc => {
                const selected = servicesOffered.includes(svc.id);
                return (
                  <div key={svc.id}
                    onClick={() => setServicesOffered(prev => selected ? prev.filter(s => s !== svc.id) : [...prev, svc.id])}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${selected ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-border hover:border-blue-300"}`}>
                    <span className="text-2xl">{svc.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{svc.label}</p>
                      <p className="text-sm text-muted-foreground">{svc.subtitle}</p>
                    </div>
                    {selected && <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={saveStep2} disabled={!servicesOffered.length} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 3: Professional Credentials ──────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-600" /> Step 3 — Professional Credentials</CardTitle>
            <CardDescription>Enter your AMFI, NISM, and regulatory registration details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ARN + EUIN — for MF */}
            {(servicesOffered.includes("mutual_fund") || servicesOffered.includes("stocks")) && (
              <div className="space-y-3 p-4 border rounded-xl">
                <h3 className="font-semibold text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <span className="text-lg">📈</span> AMFI / Mutual Fund Credentials
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>ARN Code {servicesOffered.includes("mutual_fund") ? "*" : ""}</Label>
                    <Input placeholder="ARN-12345" value={arnCode} onChange={e => setArnCode(e.target.value.toUpperCase())} className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>ARN Expiry Date *</Label>
                    <Input type="date" value={arnExpiry} onChange={e => setArnExpiry(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>EUIN Number <span className="text-muted-foreground">(if employee of distributor)</span></Label>
                    <Input placeholder="E012345" value={euinNumber} onChange={e => setEuinNumber(e.target.value.toUpperCase())} className="font-mono" />
                  </div>
                </div>
              </div>
            )}

            {/* NISM Certificate */}
            <div className="space-y-3 p-4 border rounded-xl">
              <h3 className="font-semibold text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <span className="text-lg">🎓</span> NISM Certification
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label>NISM Certificate Type *</Label>
                  <Select value={nismCertType} onValueChange={setNismCertType}>
                    <SelectTrigger><SelectValue placeholder="Select NISM Series" /></SelectTrigger>
                    <SelectContent>
                      {NISM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Certificate Number *</Label>
                  <Input placeholder="NISM-SERIESVA-XXXXXXXX-XX" value={nismCertNum} onChange={e => setNismCertNum(e.target.value.toUpperCase())} className="font-mono text-sm" />
                </div>
                <div className="space-y-1">
                  <Label>Certificate Expiry *</Label>
                  <Input type="date" value={nismExpiry} onChange={e => setNismExpiry(e.target.value)} />
                </div>
              </div>
            </div>

            {/* SEBI RIA */}
            {servicesOffered.includes("ria") && (
              <div className="space-y-3 p-4 border rounded-xl">
                <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span className="text-lg">💼</span> SEBI Registered Investment Adviser (RIA)
                </h3>
                <div className="space-y-1">
                  <Label>SEBI RIA Registration Number *</Label>
                  <Input placeholder="INA000XXXXXX" value={riaNumber} onChange={e => setRiaNumber(e.target.value.toUpperCase())} className="font-mono" />
                  <p className="text-xs text-muted-foreground">Format: INA followed by 9 digits (e.g. INA000012345)</p>
                </div>
              </div>
            )}

            {/* POSP (Insurance) */}
            {servicesOffered.includes("insurance") && (
              <div className="space-y-3 p-4 border rounded-xl">
                <h3 className="font-semibold text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <span className="text-lg">🛡️</span> POSP — Insurance Distribution
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>POSP License Number *</Label>
                    <Input placeholder="POSP-XXXXXXXX" value={pospNumber} onChange={e => setPospNumber(e.target.value)} className="font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>Issuing Insurer *</Label>
                    <Input placeholder="e.g. HDFC Life, LIC, New India" value={pospInsurer} onChange={e => setPospInsurer(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* DSA (Loans) */}
            {servicesOffered.includes("loans") && (
              <div className="space-y-3 p-4 border rounded-xl">
                <h3 className="font-semibold text-sm text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                  <span className="text-lg">🏦</span> DSA — Loan Distribution
                </h3>
                <div className="space-y-1">
                  <Label>DSA Code *</Label>
                  <Input placeholder="DSA-XXXXXX" value={dsaCode} onChange={e => setDsaCode(e.target.value.toUpperCase())} className="font-mono" />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={saveStep3} className="gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 4: Bank Account + Penny Drop ───────────────────────────────── */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /> Step 4 — Bank Account Verification</CardTitle>
            <CardDescription>Your agent payout account. Verified via penny drop — a small credit will be sent to confirm ownership.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label>Account Holder Name * <span className="text-xs text-muted-foreground">(as it appears on bank records)</span></Label>
                <Input placeholder="RAJESH KUMAR SHARMA" value={bankHolderName} onChange={e => setBankHolderName(e.target.value.toUpperCase())} disabled={bankVerified} className="font-mono uppercase" />
              </div>
              <div className="space-y-1">
                <Label>Bank Account Number *</Label>
                <Input placeholder="1234567890" value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value.replace(/\D/g, ""))} disabled={bankVerified} className="font-mono" maxLength={18} />
              </div>
              <div className="space-y-1">
                <Label>IFSC Code *</Label>
                <Input placeholder="HDFC0001234" value={bankIfsc} onChange={e => setBankIfsc(e.target.value.toUpperCase())} disabled={bankVerified} className="font-mono uppercase" maxLength={11} />
                <p className="text-xs text-muted-foreground">11 characters: Bank code (4) + 0 + Branch (6)</p>
              </div>
            </div>

            {!bankVerified ? (
              <Button onClick={verifyBank} disabled={bankVerifying || !bankAccountNumber || !bankIfsc || !bankHolderName} className="w-full gap-2">
                {bankVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {bankVerifying ? "Initiating Penny Drop…" : "Verify via Penny Drop"}
              </Button>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">Bank Account Verified ✓</p>
                  <p className="text-sm text-green-700 dark:text-green-300">{bankMsg}</p>
                  <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground mt-1" onClick={() => { setBankVerified(false); setBankMsg(""); }}>
                    Use a different account
                  </Button>
                </div>
              </div>
            )}

            {bankMsg && !bankVerified && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{bankMsg}</p>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">A ₹1 credit will be sent to verify your account ownership. This is refunded or used as the first commission credit. The name on your account must match your KYC name (80%+ match required).</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={saveStep4} disabled={!bankVerified} className="gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 5: Documents ─────────────────────────────────────────────────── */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-blue-600" /> Step 5 — Document Uploads</CardTitle>
            <CardDescription>Upload scanned copies of your certificates and identity documents. Accepted formats: PDF, JPG, PNG (max 5MB each).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "NISM Certificate *", key: "nism", value: docNism, set: setDocNism, hint: "Your NISM pass certificate PDF" },
              { label: "Graduation Certificate *", key: "grad", value: docGrad, set: setDocGrad, hint: "Required for SEBI/AMFI eligibility" },
              { label: "PAN Card *", key: "pan", value: docPan, set: setDocPan, hint: "Both sides, clear scan" },
              { label: "Cancelled Cheque *", key: "cheque", value: docCheque, set: setDocCheque, hint: "Bank account matching Step 4" },
              { label: "Passport Photo", key: "photo", value: docPhoto, set: setDocPhoto, hint: "Recent colour photo, white background" },
            ].map(doc => (
              <div key={doc.key} className="flex items-center gap-4 p-3 border rounded-xl hover:border-blue-300 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.value ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                  {doc.value ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">{doc.value ? `✓ ${doc.value}` : doc.hint}</p>
                </div>
                <Input
                  type="file"
                  className="w-28 text-xs cursor-pointer"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) doc.set(file.name);
                  }}
                />
              </div>
            ))}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">Documents are securely stored and used only for regulatory verification. Originals may be requested for in-person verification.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(4)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={saveStep5} className="gap-2">Continue <ArrowRight className="h-4 w-4" /></Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 6: Declarations ──────────────────────────────────────────────── */}
      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-blue-600" /> Step 6 — Compliance Declarations</CardTitle>
            <CardDescription>Mandatory declarations required under SEBI, PMLA, and FATCA regulations. Read carefully before signing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                id: "pmla", checked: pmla, set: setPmla,
                title: "PMLA / AML Declaration *",
                text: "I confirm that I have completed mandatory PMLA/AML training as required by the Prevention of Money Laundering Act, 2002. I undertake to identify, monitor, and report suspicious transactions as per AMFI/SEBI guidelines. I will maintain client records as required by law."
              },
              {
                id: "criminal", checked: criminal, set: setCriminal,
                title: "Criminal Record Self-Declaration",
                text: "I declare that I have not been convicted of any fraud, financial crime, or moral turpitude offence. I have not been debarred or blacklisted by SEBI, AMFI, IRDAI, or any other financial regulator. (This is a self-declaration; FintekPro reserves the right to verify independently.)"
              },
              {
                id: "fatca", checked: fatca, set: setFatca,
                title: "FATCA / CRS Declaration *",
                text: "I confirm that I am a tax resident of India and my income from financial advisory activities is reportable under Indian tax law. I undertake to comply with FATCA / CRS reporting requirements for applicable clients."
              },
              {
                id: "coc", checked: coc, set: setCoc,
                title: "AMFI / SEBI Code of Conduct *",
                text: "I agree to abide by the AMFI Code of Conduct for Mutual Fund Distributors and SEBI (Investment Advisers) Regulations 2013. I commit to: acting in clients' best interests, fair and unbiased recommendation of financial products, full disclosure of commissions and conflicts of interest, and maintaining client confidentiality."
              },
              {
                id: "antimis", checked: antiMis, set: setAntiMis,
                title: "Anti-Mis-Selling Undertaking *",
                text: "I undertake not to mis-sell financial products. I will assess clients' financial goals, risk appetite, and suitability before any recommendation. I will not make false or exaggerated claims about returns. I understand that mis-selling is a SEBI/AMFI violation punishable by suspension of ARN/EUIN."
              },
            ].map(decl => (
              <div key={decl.id} className={`p-4 border-2 rounded-xl transition-colors ${decl.checked ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" : "border-border"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox id={decl.id} checked={decl.checked} onCheckedChange={(v) => decl.set(v === true)} className="mt-1" />
                  <div className="space-y-1">
                    <label htmlFor={decl.id} className="font-semibold text-sm cursor-pointer">{decl.title}</label>
                    <p className="text-xs text-muted-foreground leading-relaxed">{decl.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(5)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={saveStep6} disabled={!pmla || !fatca || !coc || !antiMis} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── STEP 7: Review & Submit ──────────────────────────────────────────── */}
      {step === 7 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" /> Step 7 — Review & Submit</CardTitle>
            <CardDescription>Review all details before submitting for admin approval. You cannot edit after submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Identity */}
            <div className="p-4 border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Identity</h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Edit</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">PAN</p><p className="font-medium flex items-center gap-1">{panNumber} {panVerified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
                <div><p className="text-xs text-muted-foreground">Registered Name</p><p className="font-medium">{panName}</p></div>
                <div><p className="text-xs text-muted-foreground">Aadhaar</p><p className="font-medium flex items-center gap-1">****{aadhaarLast4} {aadhaarVerified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
              </div>
            </div>

            {/* Services */}
            <div className="p-4 border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Services</h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(2)}>Edit</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {servicesOffered.map(s => <Badge key={s} variant="secondary">{SERVICE_OPTIONS.find(x => x.id === s)?.label || s}</Badge>)}
              </div>
            </div>

            {/* Credentials */}
            <div className="p-4 border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Credentials</h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(3)}>Edit</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {arnCode && <div><p className="text-xs text-muted-foreground">ARN</p><p className="font-mono font-medium">{arnCode}</p></div>}
                {euinNumber && <div><p className="text-xs text-muted-foreground">EUIN</p><p className="font-mono font-medium">{euinNumber}</p></div>}
                {nismCertNum && <div><p className="text-xs text-muted-foreground">NISM Cert</p><p className="font-mono font-medium text-xs">{nismCertNum}</p></div>}
                {nismCertType && <div><p className="text-xs text-muted-foreground">NISM Series</p><p className="font-medium">{nismCertType}</p></div>}
                {riaNumber && <div><p className="text-xs text-muted-foreground">SEBI RIA</p><p className="font-mono font-medium">{riaNumber}</p></div>}
                {pospNumber && <div><p className="text-xs text-muted-foreground">POSP</p><p className="font-mono font-medium">{pospNumber}</p></div>}
                {dsaCode && <div><p className="text-xs text-muted-foreground">DSA Code</p><p className="font-mono font-medium">{dsaCode}</p></div>}
              </div>
            </div>

            {/* Bank */}
            <div className="p-4 border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Bank Account</h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(4)}>Edit</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Account Holder</p><p className="font-medium">{bankHolderName}</p></div>
                <div><p className="text-xs text-muted-foreground">Account Number</p><p className="font-mono font-medium">{'*'.repeat(Math.max(0, bankAccountNumber.length - 4))}{bankAccountNumber.slice(-4)}</p></div>
                <div><p className="text-xs text-muted-foreground">IFSC</p><p className="font-mono font-medium">{bankIfsc}</p></div>
                <div><p className="text-xs text-muted-foreground">Bank</p><p className="font-medium flex items-center gap-1">{bankName || "—"} {bankVerified && <CheckCircle className="h-3 w-3 text-green-600" />}</p></div>
              </div>
            </div>

            {/* Declarations summary */}
            <div className="p-4 border rounded-xl space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Declarations</h3>
              <div className="grid grid-cols-1 gap-1 text-sm">
                {[
                  ["PMLA / AML", pmla], ["Criminal Record (None)", criminal],
                  ["FATCA / CRS", fatca], ["Code of Conduct", coc], ["Anti-Mis-Selling", antiMis],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    {val ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span className={val ? "text-foreground" : "text-red-600"}>{label as string}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Before you submit</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Ensure all details are accurate. False declarations are punishable under applicable laws. You will not be able to edit after submission.</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(6)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !bankVerified || !panVerified}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Submit for Approval
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
