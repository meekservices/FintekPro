import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import {
  User, Mail, Phone, Building2, BadgeCheck, ShieldCheck, ShieldAlert,
  CreditCard, Landmark, Edit2, Save, X, Award, Briefcase, Calendar,
  CheckCircle2, Clock, XCircle, KeyRound, Layers, GraduationCap
} from "lucide-react";

interface PartnerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  roles: string[];
  profileImageUrl: string | null;
  joinedAt: string | null;
  empanelmentStatus: string | null;
  companyName: string | null;
  partnerLevel: string;
  partnerType: string;
  hierarchyStatus: string;
  kycStatus: string;
  approvalStatus: string;
  arnCode: string | null;
  panNumber: string | null;
  panVerified: boolean;
  panName: string | null;
  aadhaarVerified: boolean;
  euinNumber: string | null;
  nismCertificateNumber: string | null;
  nismCertificateType: string | null;
  nismExpiryDate: string | null;
  riaNumber: string | null;
  pospNumber: string | null;
  servicesOffered: string[];
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankVerified: boolean;
  bankAccountHolderName: string | null;
  isCaQualified: boolean;
  caMembershipNumber: string | null;
  caVerificationStatus: string | null;
  caVerifiedAt: string | null;
}

function StatusBadge({ value, trueLabel = "Verified", falseLabel = "Pending" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return value
    ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 gap-1"><CheckCircle2 className="h-3 w-3" />{trueLabel}</Badge>
    : <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1"><Clock className="h-3 w-3" />{falseLabel}</Badge>;
}

function Field({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: any }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <p className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground italic">Not provided</span>}</p>
      </div>
    </div>
  );
}

function maskAccount(n: string | null) {
  if (!n) return null;
  if (n.length <= 4) return n;
  return "•".repeat(n.length - 4) + n.slice(-4);
}

export default function PartnerMyProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", mobile: "", companyName: "" });
  const [caEditing, setCaEditing] = useState(false);
  const [caForm, setCaForm] = useState({ isCaQualified: false, caMembershipNumber: "" });

  const { data: profile, isLoading } = useQuery<PartnerProfile>({
    queryKey: ["/api/partner/profile"],
    select: (d: any) => d,
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/partner/profile", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partner/ca-status"] });
      setEditing(false);
      setCaEditing(false);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: () => toast({ title: "Update failed", description: "Please try again.", variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (membershipNumber: string) =>
      apiRequest("/api/partner/verify-ca-membership", { method: "POST", body: JSON.stringify({ membershipNumber }) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/profile"] });
      if (data?.status === "verified") {
        toast({ title: "ICAI Membership Verified", description: data.memberName ? `Verified: ${data.memberName} (${data.memberType || "CA"})` : "Your ICAI membership has been verified." });
      } else if (data?.status === "pending_review") {
        toast({ title: "Submitted for Review", description: "Your ICAI number format is valid and has been queued for admin verification." });
      }
    },
    onError: (err: any) => toast({
      title: "Verification failed",
      description: err?.message || "Could not verify ICAI number. Please check and try again.",
      variant: "destructive",
    }),
  });

  const startEdit = () => {
    if (!profile) return;
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      mobile: profile.mobile,
      companyName: profile.companyName || "",
    });
    setEditing(true);
  };

  const startCaEdit = () => {
    if (!profile) return;
    setCaForm({
      isCaQualified: profile.isCaQualified,
      caMembershipNumber: profile.caMembershipNumber || "",
    });
    setCaEditing(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-indigo-800/30 animate-pulse" />)}
      </div>
    );
  }

  if (!profile) return null;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  const initials = [profile.firstName?.[0], profile.lastName?.[0]].filter(Boolean).join("").toUpperCase() || profile.email[0].toUpperCase();

  const statusColor = (s: string) => {
    const u = (s || "").toUpperCase();
    if (["ACTIVE", "APPROVED", "VERIFIED"].includes(u)) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    if (["PENDING", "UNDER_REVIEW"].includes(u)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header Card ── */}
      <Card className="bg-gradient-to-r from-indigo-900 to-violet-900 border-indigo-700 text-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center text-3xl font-bold text-white shrink-0 shadow-lg">
              {profile.profileImageUrl
                ? <img src={profile.profileImageUrl} alt={fullName} className="w-full h-full object-cover rounded-2xl" />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{fullName}</h1>
              {profile.companyName && <p className="text-indigo-200 text-sm mt-0.5">{profile.companyName}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge className="bg-violet-700 text-violet-100 border-0">
                  <Layers className="h-3 w-3 mr-1" />
                  {profile.partnerLevel} · {profile.partnerType}
                </Badge>
                <Badge className={statusColor(profile.hierarchyStatus) + " border-0"}>
                  {profile.hierarchyStatus}
                </Badge>
                <Badge className={statusColor(profile.kycStatus) + " border-0"}>
                  KYC: {profile.kycStatus}
                </Badge>
                {profile.empanelmentStatus && (
                  <Badge className={statusColor(profile.empanelmentStatus) + " border-0"}>
                    Empanelment: {profile.empanelmentStatus}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-indigo-500 text-white hover:bg-indigo-700 shrink-0"
              onClick={editing ? () => setEditing(false) : startEdit}
            >
              {editing ? <><X className="h-4 w-4 mr-1" />Cancel</> : <><Edit2 className="h-4 w-4 mr-1" />Edit Profile</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Personal Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" /> Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">First Name</Label>
                    <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Last Name</Label>
                    <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className="h-8 text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mobile</Label>
                  <Input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} className="h-8 text-sm" placeholder="+91 XXXXX XXXXX" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company / Firm Name</Label>
                  <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} className="h-8 text-sm" placeholder="Optional" />
                </div>
                <Button
                  size="sm"
                  className="w-full bg-violet-600 hover:bg-violet-700"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(form)}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Full Name" value={fullName} icon={User} />
                <Field label="Email" value={profile.email} icon={Mail} />
                <Field label="Mobile" value={profile.mobile} icon={Phone} />
                {profile.companyName && <Field label="Company / Firm" value={profile.companyName} icon={Building2} />}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Partner Since</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── KYC & Identity ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" /> KYC & Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">PAN Card</p>
                  <p className="text-xs text-muted-foreground">{profile.panNumber || "Not submitted"}</p>
                </div>
              </div>
              <StatusBadge value={profile.panVerified} />
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Aadhaar</p>
                  <p className="text-xs text-muted-foreground">{profile.aadhaarVerified ? "Verified" : "Not submitted"}</p>
                </div>
              </div>
              <StatusBadge value={profile.aadhaarVerified} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Bank Account</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.bankAccountNumber ? maskAccount(profile.bankAccountNumber) + (profile.bankName ? ` · ${profile.bankName}` : "") : "Not submitted"}
                  </p>
                </div>
              </div>
              <StatusBadge value={profile.bankVerified} />
            </div>
            {profile.panName && (
              <>
                <Separator />
                <Field label="Name as per PAN" value={profile.panName} icon={User} />
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Professional Credentials ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-600" /> Professional Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="ARN Code" value={profile.arnCode} icon={BadgeCheck} />
            <Separator />
            <Field label="EUIN Number" value={profile.euinNumber} icon={KeyRound} />
            <Field label="NISM Certificate" value={profile.nismCertificateNumber} icon={Award} />
            {profile.nismCertificateType && <Field label="NISM Type" value={profile.nismCertificateType} icon={Briefcase} />}
            {profile.nismExpiryDate && <Field label="NISM Expiry" value={profile.nismExpiryDate} icon={Calendar} />}
            {profile.riaNumber && <><Separator /><Field label="RIA Number" value={profile.riaNumber} icon={BadgeCheck} /></>}
            {profile.pospNumber && <Field label="POSP Number" value={profile.pospNumber} icon={BadgeCheck} />}
            {profile.servicesOffered && profile.servicesOffered.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services Offered</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {profile.servicesOffered.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Bank Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-600" /> Bank Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.bankAccountNumber ? (
              <>
                <div className="flex items-center justify-between">
                  <Field label="Account Number" value={maskAccount(profile.bankAccountNumber)} icon={Landmark} />
                  <StatusBadge value={profile.bankVerified} trueLabel="Penny Drop Verified" falseLabel="Not Verified" />
                </div>
                <Field label="Account Holder" value={profile.bankAccountHolderName} icon={User} />
                <Field label="IFSC Code" value={profile.bankIfsc} icon={Briefcase} />
                {profile.bankName && <Field label="Bank" value={profile.bankName + (profile.bankBranch ? ` · ${profile.bankBranch}` : "")} icon={Building2} />}
                <Separator />
                <p className="text-xs text-muted-foreground">To update bank details, please go through the Agent Empanelment KYC wizard or contact support.</p>
              </>
            ) : (
              <div className="text-center py-6 space-y-3">
                <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-sm font-medium">No bank details on file</p>
                <p className="text-xs text-muted-foreground">Complete the Agent Empanelment KYC flow to add your bank account.</p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/agent/empanelment">Go to Empanelment</a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── CA Qualification ── */}
      <Card className={profile.isCaQualified ? "border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-800" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className={`h-4 w-4 ${profile.isCaQualified ? "text-emerald-600" : "text-muted-foreground"}`} />
              CA Qualification
              {profile.isCaQualified && profile.caVerificationStatus === "verified" && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 ml-1">
                  <CheckCircle2 className="h-3 w-3" /> ICAI Verified
                </Badge>
              )}
              {profile.isCaQualified && profile.caVerificationStatus !== "verified" && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1 ml-1 text-[11px]">
                  <ShieldAlert className="h-3 w-3" /> Verification Pending
                </Badge>
              )}
            </CardTitle>
            {!caEditing && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={startCaEdit}>
                <Edit2 className="h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {caEditing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch
                  id="ca-toggle"
                  checked={caForm.isCaQualified}
                  onCheckedChange={v => setCaForm(f => ({ ...f, isCaQualified: v }))}
                />
                <div>
                  <Label htmlFor="ca-toggle" className="text-sm font-medium cursor-pointer">
                    I am a Chartered Accountant (CA)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enables ITR filing cases, CA assignments, and Form 15CA/15CB workflows
                  </p>
                </div>
              </div>
              {caForm.isCaQualified && (
                <div className="space-y-1.5">
                  <Label htmlFor="ca-member" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    ICAI Membership Number
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="ca-member"
                      placeholder="e.g. 123456"
                      value={caForm.caMembershipNumber}
                      onChange={e => setCaForm(f => ({ ...f, caMembershipNumber: e.target.value }))}
                      className="h-8 text-sm"
                      maxLength={6}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs whitespace-nowrap border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400"
                      disabled={!caForm.caMembershipNumber || caForm.caMembershipNumber.length < 6 || verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate(caForm.caMembershipNumber)}
                    >
                      {verifyMutation.isPending
                        ? <span className="animate-spin rounded-full h-3 w-3 border-t border-indigo-600 inline-block" />
                        : <ShieldCheck className="h-3 w-3" />
                      }
                      {verifyMutation.isPending ? "Verifying…" : "Verify"}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">6-digit ICAI membership number (ACA/FCA). Verification checks the ICAI registry.</p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 gap-1" disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(caForm as any)}>
                  <Save className="h-3 w-3" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setCaEditing(false)}>
                  <X className="h-3 w-3" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  profile.isCaQualified ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-slate-100 dark:bg-slate-800"
                }`}>
                  <GraduationCap className={`h-5 w-5 ${profile.isCaQualified ? "text-emerald-600" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {profile.isCaQualified ? "Chartered Accountant" : "Non-CA Partner"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {profile.isCaQualified
                      ? "Full CA workflow access — ITR cases, Form 15CA/15CB, CA assignments"
                      : "Partner & agent management only — CA workflows not applicable"}
                  </p>
                </div>
              </div>
              {profile.isCaQualified && (
                <div className="space-y-3">
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ICAI Membership Number</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium text-foreground">
                          {profile.caMembershipNumber || <span className="text-muted-foreground italic">Not provided</span>}
                        </p>
                      </div>
                      {/* Verification status badge */}
                      {profile.caVerificationStatus === "verified" && (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> ICAI Verified
                        </Badge>
                      )}
                      {profile.caVerificationStatus === "pending_review" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1 text-[11px]">
                          <Clock className="h-3 w-3" /> Pending Review
                        </Badge>
                      )}
                      {(profile.caVerificationStatus === "unverified" || !profile.caVerificationStatus) && profile.caMembershipNumber && (
                        <Badge variant="outline" className="text-slate-500 border-slate-300 gap-1 text-[11px]">
                          <ShieldAlert className="h-3 w-3" /> Unverified
                        </Badge>
                      )}
                      {profile.caVerificationStatus === "failed" && (
                        <Badge variant="outline" className="text-red-600 border-red-300 gap-1 text-[11px]">
                          <XCircle className="h-3 w-3" /> Not Found in ICAI
                        </Badge>
                      )}
                      {/* Verify button — shown when unverified or failed */}
                      {profile.caMembershipNumber && profile.caVerificationStatus !== "verified" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px] gap-1 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400"
                          disabled={verifyMutation.isPending}
                          onClick={() => verifyMutation.mutate(profile.caMembershipNumber!)}
                        >
                          {verifyMutation.isPending
                            ? <><span className="animate-spin rounded-full h-3 w-3 border-t border-indigo-600 inline-block" /> Verifying...</>
                            : <><ShieldCheck className="h-3 w-3" /> Verify Now</>
                          }
                        </Button>
                      )}
                    </div>
                    {profile.caVerifiedAt && profile.caVerificationStatus === "verified" && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Verified on {new Date(profile.caVerifiedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">CA Access Unlocked</p>
                    <ul className="text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5 list-disc list-inside">
                      <li>ITR filing &amp; review cases</li>
                      <li>Form 15CA / 15CB preparation</li>
                      <li>CA Management dashboard</li>
                      <li>CA Support ticket queue</li>
                    </ul>
                  </div>
                </div>
              )}
              {!profile.isCaQualified && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Standard Partner Access</p>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 list-disc list-inside">
                    <li>Manage partners &amp; agents under you</li>
                    <li>Mutual fund &amp; equity distribution</li>
                    <li>Revenue &amp; payout tracking</li>
                    <li>CA-related workflows not applicable</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Account Info ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" /> Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Partner ID</p>
              <p className="text-xs font-mono bg-muted px-2 py-1 rounded truncate">{profile.id}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Partner Level</p>
              <Badge variant="outline">{profile.partnerLevel}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Roles</p>
              <div className="flex flex-wrap gap-1">
                {(profile.roles || []).map((r, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Status</p>
              <Badge className={statusColor(profile.approvalStatus)}>{profile.approvalStatus}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
