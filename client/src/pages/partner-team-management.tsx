import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, UserPlus, Banknote, Percent, Copy, Link2,
  CheckCircle, Clock, XCircle, Trash2, Edit2, Save, X,
  ShieldCheck, UserCheck, TrendingUp, Loader2, AlertCircle, Info
} from "lucide-react";
import { format } from "date-fns";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

// ── My Team Tab ──────────────────────────────────────────────────────────────
function MyTeamTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingSMRM, setEditingSMRM] = useState<string | null>(null);
  const [smrmForm, setSmrmForm] = useState({ smName: "", smEmail: "", rmName: "", rmEmail: "" });

  const { data: team = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/partner/my-team"] });

  const smrmMutation = useMutation({
    mutationFn: (params: { agentUserId: string; data: any }) =>
      apiRequest("PUT", `/api/partner/agents/${params.agentUserId}/sm-rm`, params.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/partner/my-team"] });
      setEditingSMRM(null);
      toast({ title: "SM/RM assigned successfully" });
    },
    onError: () => toast({ title: "Failed to assign SM/RM", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (agentUserId: string) => apiRequest("DELETE", `/api/partner/my-team/${agentUserId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/partner/my-team"] });
      toast({ title: "Agent removed from team" });
    },
    onError: () => toast({ title: "Failed to remove agent", variant: "destructive" }),
  });

  const startEdit = (member: any) => {
    setEditingSMRM(member.agent_user_id);
    setSmrmForm({
      smName: member.sm_name || "",
      smEmail: member.sm_email || "",
      rmName: member.rm_name || "",
      rmEmail: member.rm_email || "",
    });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (team.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="font-medium">No agents in your team yet</p>
        <p className="text-sm mt-1">Invite agents using the "Invite Agent" tab — when they join, they appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
        <Info className="h-4 w-4 flex-shrink-0" />
        <span>You earn <strong>partner-level override commission</strong> on every transaction your team agents close, in addition to your own agent commissions.</span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>SM Assigned</TableHead>
              <TableHead>RM Assigned</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member: any) => (
              <>
                <TableRow key={member.agent_user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{member.first_name} {member.last_name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      {member.mobile && <p className="text-xs text-muted-foreground">{member.mobile}</p>}
                      {member.arn_number && <p className="text-xs text-green-600 font-medium">ARN: {member.arn_number}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === "active" ? "default" : "secondary"} className="capitalize">
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.empanelment_status === "approved" ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Empanelled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        <Clock className="h-3 w-3 mr-1" /> {member.empanelment_status || "Pending"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.sm_name ? (
                      <div>
                        <p className="text-sm font-medium">{member.sm_name}</p>
                        <p className="text-xs text-muted-foreground">{member.sm_email}</p>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    {member.rm_name ? (
                      <div>
                        <p className="text-sm font-medium">{member.rm_name}</p>
                        <p className="text-xs text-muted-foreground">{member.rm_email}</p>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {member.joined_at ? format(new Date(member.joined_at), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => startEdit(member)}>
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> SM/RM
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeMutation.mutate(member.agent_user_id)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {editingSMRM === member.agent_user_id && (
                  <TableRow key={`smrm-${member.agent_user_id}`} className="bg-muted/30">
                    <TableCell colSpan={7}>
                      <div className="p-3 space-y-3">
                        <p className="text-sm font-medium text-foreground">Assign SM / RM for {member.first_name} {member.last_name}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs">SM Name</Label>
                            <Input value={smrmForm.smName} onChange={e => setSmrmForm(f => ({ ...f, smName: e.target.value }))} placeholder="Sales Manager name" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">SM Email</Label>
                            <Input value={smrmForm.smEmail} onChange={e => setSmrmForm(f => ({ ...f, smEmail: e.target.value }))} placeholder="sm@company.com" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">RM Name</Label>
                            <Input value={smrmForm.rmName} onChange={e => setSmrmForm(f => ({ ...f, rmName: e.target.value }))} placeholder="Relationship Manager" className="h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">RM Email</Label>
                            <Input value={smrmForm.rmEmail} onChange={e => setSmrmForm(f => ({ ...f, rmEmail: e.target.value }))} placeholder="rm@company.com" className="h-8 text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => smrmMutation.mutate({ agentUserId: member.agent_user_id, data: smrmForm })}
                            disabled={smrmMutation.isPending}
                          >
                            {smrmMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingSMRM(null)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Invite Agent Tab ─────────────────────────────────────────────────────────
function InviteAgentTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ inviteeName: "", inviteeEmail: "", inviteeMobile: "" });
  const [lastInvite, setLastInvite] = useState<{ inviteCode: string; inviteLink: string } | null>(null);

  const { data: invitations = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/partner/invitations"] });

  const inviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/partner/invite-agent", data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setLastInvite(data);
      setForm({ inviteeName: "", inviteeEmail: "", inviteeMobile: "" });
      qc.invalidateQueries({ queryKey: ["/api/partner/invitations"] });
      toast({ title: "Invitation created", description: `Code: ${data.inviteCode}` });
    },
    onError: () => toast({ title: "Failed to create invitation", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/partner/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/partner/invitations"] });
      toast({ title: "Invitation cancelled" });
    },
  });

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copied to clipboard" });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
      accepted: { label: "Accepted", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
      expired: { label: "Expired", className: "bg-gray-100 text-gray-600" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
    };
    const s = map[status] || { label: status, className: "" };
    return <Badge className={`${s.className} border-0 text-xs`}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /> Create Agent Invitation</CardTitle>
          <CardDescription>Generate a unique invite link. When an agent registers using your link, they automatically join your team and you get promoted to Partner (dual role).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Agent Name (optional)</Label>
              <Input value={form.inviteeName} onChange={e => setForm(f => ({ ...f, inviteeName: e.target.value }))} placeholder="e.g. Ramesh Sharma" />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input type="email" value={form.inviteeEmail} onChange={e => setForm(f => ({ ...f, inviteeEmail: e.target.value }))} placeholder="agent@email.com" />
            </div>
            <div>
              <Label>Mobile (optional)</Label>
              <Input value={form.inviteeMobile} onChange={e => setForm(f => ({ ...f, inviteeMobile: e.target.value }))} placeholder="9XXXXXXXXX" />
            </div>
          </div>
          <Button onClick={() => inviteMutation.mutate(form)} disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            Generate Invite Link
          </Button>
        </CardContent>
      </Card>

      {lastInvite && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-green-800 dark:text-green-200">Invitation Created!</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">Code: <strong>{lastInvite.inviteCode}</strong></p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-white dark:bg-black/20 border rounded px-2 py-1 flex-1 truncate">{lastInvite.inviteLink}</code>
                  <Button size="sm" variant="outline" onClick={() => copyLink(lastInvite.inviteLink)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">Share this link with the agent. Valid for 30 days.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Invitation History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : invitations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No invitations sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitee</TableHead>
                  <TableHead>Invite Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{inv.invitee_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{inv.invitee_email || inv.invitee_mobile || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{inv.invite_code}</code>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.expires_at ? format(new Date(inv.expires_at), "dd MMM yy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {inv.created_at ? format(new Date(inv.created_at), "dd MMM yy") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status === "pending" && (
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600"
                          onClick={() => cancelMutation.mutate(inv.id)} disabled={cancelMutation.isPending}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Bank Account Tab ──────────────────────────────────────────────────────────
function BankAccountTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ bankAccountNumber: "", ifscCode: "", bankAccountHolderName: "", upiId: "" });
  const [loaded, setLoaded] = useState(false);

  const { data: bank, isLoading } = useQuery<any>({
    queryKey: ["/api/partner/bank"],
    select: (d: any) => d,
  });

  if (bank && !loaded) {
    setForm({
      bankAccountNumber: bank.bank_account_number || "",
      ifscCode: bank.ifsc_code || "",
      bankAccountHolderName: bank.bank_account_holder_name || "",
      upiId: bank.upi_id || "",
    });
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/partner/bank", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/partner/bank"] });
      toast({ title: "Bank details saved successfully" });
    },
    onError: () => toast({ title: "Failed to save bank details", variant: "destructive" }),
  });

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> Partner Bank Account</CardTitle>
          <CardDescription>Bank account for receiving commission payouts and team override income.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {bank?.cashfree_bank_verified && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
                  <CheckCircle className="h-4 w-4" />
                  <span>Bank account verified via penny drop</span>
                </div>
              )}
              <div>
                <Label>Account Holder Name</Label>
                <Input value={form.bankAccountHolderName} onChange={e => setForm(f => ({ ...f, bankAccountHolderName: e.target.value }))} placeholder="Name as per bank records" />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} placeholder="Account number" />
              </div>
              <div>
                <Label>IFSC Code</Label>
                <Input value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} placeholder="e.g. HDFC0001234" className="uppercase" />
              </div>
              <div>
                <Label>UPI ID (optional)</Label>
                <Input value={form.upiId} onChange={e => setForm(f => ({ ...f, upiId: e.target.value }))} placeholder="yourname@upi" />
              </div>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending || !form.bankAccountNumber || !form.ifscCode || !form.bankAccountHolderName}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Bank Details
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Commission Splits Tab ─────────────────────────────────────────────────────
function CommissionSplitsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [pct, setPct] = useState<string>("");

  const { data: splits = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/partner/commission-splits"] });

  const saveMutation = useMutation({
    mutationFn: (params: { agentUserId: string; pct: number }) =>
      apiRequest("PUT", `/api/partner/commission-splits/${params.agentUserId}`, { commissionSplitPct: params.pct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/partner/commission-splits"] });
      setEditing(null);
      toast({ title: "Commission split updated" });
    },
    onError: () => toast({ title: "Failed to update split", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold">How commission splits work</p>
              <p className="mt-1">You receive the full partner override commission from the platform. The split % you configure here is the portion you pass on to each agent from <em>your</em> share. Example: if platform pays you ₹1,000 override and you set 60% for an agent, they get ₹600 and you keep ₹400.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : splits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Percent className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No active team members yet</p>
          <p className="text-sm mt-1">Add agents via Invite Agent — they will appear here once they join.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Current Split</TableHead>
                  <TableHead>Agent Gets</TableHead>
                  <TableHead>You Keep</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splits.map((s: any) => (
                  <TableRow key={s.agent_user_id}>
                    <TableCell>
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell>
                      {editing === s.agent_user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" min={0} max={100} className="h-7 w-20 text-sm"
                            value={pct}
                            onChange={e => setPct(e.target.value)}
                          />
                          <span className="text-sm">%</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="font-mono">{Number(s.commission_split_pct || 0).toFixed(0)}%</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-green-600 font-medium text-sm">
                      {Number(s.commission_split_pct || 0).toFixed(0)}% of override
                    </TableCell>
                    <TableCell className="text-blue-600 font-medium text-sm">
                      {(100 - Number(s.commission_split_pct || 0)).toFixed(0)}% of override
                    </TableCell>
                    <TableCell className="text-right">
                      {editing === s.agent_user_id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm"
                            onClick={() => saveMutation.mutate({ agentUserId: s.agent_user_id, pct: Number(pct) })}
                            disabled={saveMutation.isPending}
                          >
                            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setEditing(s.agent_user_id); setPct(String(Number(s.commission_split_pct || 0))); }}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PartnerTeamManagement() {
  const { data: team = [] } = useQuery<any[]>({ queryKey: ["/api/partner/my-team"] });
  const { data: invitations = [] } = useQuery<any[]>({ queryKey: ["/api/partner/invitations"] });
  const pending = (invitations as any[]).filter((i: any) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> My Agent Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your sub-agents, invite new agents, configure commissions, and assign SM/RM.
          As a partner, you earn <strong>both agent commissions</strong> and <strong>team override income</strong>.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-primary">{(team as any[]).length}</p>
            <p className="text-sm text-muted-foreground mt-1">Active Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{pending}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending Invites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <UserCheck className="h-5 w-5 text-green-600" />
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Dual Role Active</p>
            <p className="text-xs text-green-600 font-medium">Agent + Partner</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="team">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="team" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> My Team
            {(team as any[]).length > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px]">{(team as any[]).length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Invite Agent
            {pending > 0 && <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">{pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" /> Bank Account
          </TabsTrigger>
          <TabsTrigger value="splits" className="flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Commission Splits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4"><MyTeamTab /></TabsContent>
        <TabsContent value="invite" className="mt-4"><InviteAgentTab /></TabsContent>
        <TabsContent value="bank" className="mt-4"><BankAccountTab /></TabsContent>
        <TabsContent value="splits" className="mt-4"><CommissionSplitsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
