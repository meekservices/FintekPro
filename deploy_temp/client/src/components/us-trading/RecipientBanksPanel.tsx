/**
 * Recipient Banks Panel
 * Add Indian / international bank accounts for USD wire withdrawal.
 * Lists existing recipient banks and allows creating + deleting them.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Landmark, Plus, Trash2, AlertTriangle, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RecipientBanksPanelProps {
  alpacaAccountId: string;
}

export default function RecipientBanksPanel({ alpacaAccountId }: RecipientBanksPanelProps) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [form, setForm] = useState({
    name: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_type: "INTERNATIONAL" as "INTERNATIONAL" | "CHECKING" | "SAVINGS",
    bank_swift_code: "",
    bank_iban: "",
    bank_routing_number: "",
    country: "IN",
    currency: "USD",
    bank_address: "",
    beneficiary_address: "",
  });

  const { data, isLoading, refetch } = useQuery<{ success: boolean; banks: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts", alpacaAccountId, "recipient-banks"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${alpacaAccountId}/recipient-banks`).then(r => r.json()),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/us-trading/broker/accounts/${alpacaAccountId}/recipient-banks`, form),
    onSuccess: () => {
      toast({ title: "Recipient bank added" });
      setAddOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed to add bank", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (bankId: string) =>
      apiRequest("DELETE", `/api/us-trading/broker/accounts/${alpacaAccountId}/recipient-banks/${bankId}`),
    onSuccess: () => {
      toast({ title: "Recipient bank removed" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Failed to remove bank", description: e.message, variant: "destructive" }),
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/us-trading/broker/accounts/${alpacaAccountId}/wire-withdrawal`, {
        amount: parseFloat(withdrawAmount),
        currency: "USD",
        recipient_bank_id: selectedBankId,
      }),
    onSuccess: () => {
      toast({ title: "Wire withdrawal initiated", description: `$${withdrawAmount} withdrawal queued` });
      setWithdrawOpen(false);
    },
    onError: (e: any) => toast({ title: "Withdrawal failed", description: e.message, variant: "destructive" }),
  });

  const banks = data?.banks ?? [];

  return (
    <div className="space-y-5">
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm text-amber-700 dark:text-amber-300">
          <strong>FEMA / LRS Notice:</strong> Wire withdrawals back to India are subject to RBI FEMA regulations. Capital gains must be declared per Indian tax law. Ensure your bank supports inward SWIFT remittances.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Registered Withdrawal Banks</h3>
        <div className="flex gap-2">
          {banks.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setWithdrawOpen(true)}>
              <Send className="h-3.5 w-3.5" /> Withdraw
            </Button>
          )}
          <Button size="sm" className="gap-1.5 h-8" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Bank
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : banks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No recipient banks added</p>
            <p className="text-xs text-muted-foreground mb-4">Add your Indian bank account to withdraw USD proceeds.</p>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Recipient Bank
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>SWIFT</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.map((bank: any) => (
              <TableRow key={bank.id}>
                <TableCell className="font-medium text-sm">{bank.name}</TableCell>
                <TableCell className="text-sm">{bank.bank_name}</TableCell>
                <TableCell className="font-mono text-xs">****{bank.bank_account_number?.slice(-4)}</TableCell>
                <TableCell className="text-xs">{bank.bank_swift_code || "—"}</TableCell>
                <TableCell className="text-xs">{bank.country}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    bank.status === "ACTIVE" ? "text-green-700 border-green-300" :
                    bank.status === "PENDING" ? "text-yellow-700 border-yellow-300" :
                    "text-red-700 border-red-300"
                  }>
                    {bank.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => deleteMutation.mutate(bank.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Bank Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Add Recipient Bank
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Beneficiary Name *</Label>
                <Input className="h-8 text-sm mt-1" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
              </div>
              <div>
                <Label className="text-xs">Bank Name *</Label>
                <Input className="h-8 text-sm mt-1" value={form.bank_name}
                  onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="HDFC Bank" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Account Number *</Label>
                <Input className="h-8 text-sm mt-1 font-mono" value={form.bank_account_number}
                  onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Account Type</Label>
                <Select value={form.bank_account_type} onValueChange={(v: any) => setForm(f => ({ ...f, bank_account_type: v }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNATIONAL">International (SWIFT)</SelectItem>
                    <SelectItem value="CHECKING">Checking (US ACH)</SelectItem>
                    <SelectItem value="SAVINGS">Savings (US ACH)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SWIFT / BIC Code</Label>
                <Input className="h-8 text-sm mt-1 font-mono uppercase" value={form.bank_swift_code}
                  onChange={e => setForm(f => ({ ...f, bank_swift_code: e.target.value.toUpperCase() }))}
                  placeholder="HDFCINBB" />
              </div>
              <div>
                <Label className="text-xs">IBAN (if applicable)</Label>
                <Input className="h-8 text-sm mt-1 font-mono" value={form.bank_iban}
                  onChange={e => setForm(f => ({ ...f, bank_iban: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Country Code *</Label>
                <Input className="h-8 text-sm mt-1 uppercase" maxLength={2} value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value.toUpperCase() }))} placeholder="IN" />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Input className="h-8 text-sm mt-1 uppercase" maxLength={3} value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="USD" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Bank Address</Label>
              <Input className="h-8 text-sm mt-1" value={form.bank_address}
                onChange={e => setForm(f => ({ ...f, bank_address: e.target.value }))} placeholder="Branch address" />
            </div>
            <div>
              <Label className="text-xs">Beneficiary Address</Label>
              <Input className="h-8 text-sm mt-1" value={form.beneficiary_address}
                onChange={e => setForm(f => ({ ...f, beneficiary_address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.name || !form.bank_name || !form.bank_account_number}>
              {addMutation.isPending ? "Adding…" : "Add Bank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Initiate Wire Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Select Recipient Bank</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Select bank…" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (USD)</Label>
              <Input type="number" className="h-9 text-sm mt-1" value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)} placeholder="500.00" min="1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !selectedBankId || !withdrawAmount}
            >
              {withdrawMutation.isPending ? "Processing…" : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
