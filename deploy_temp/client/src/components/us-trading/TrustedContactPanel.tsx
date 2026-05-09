/**
 * Trusted Contact Panel
 * FINRA Rule 4512 compliance — brokers must make reasonable effort to obtain
 * a trusted contact person for each account. Required for India-resident customers
 * whose accounts hold US securities.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  UserCheck, Plus, Pencil, Trash2, RefreshCw, Info, Phone, Mail, MapPin, Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TrustedContactPanelProps {
  accountId?: string;
}

interface TrustedContact {
  given_name?: string;
  family_name?: string;
  email_address?: string;
  phone_number?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  street_address?: string[];
}

const EMPTY_FORM: TrustedContact = {
  given_name: "",
  family_name: "",
  email_address: "",
  phone_number: "",
  city: "",
  state: "",
  postal_code: "",
  country: "IND",
};

export default function TrustedContactPanel({ accountId }: TrustedContactPanelProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TrustedContact>(EMPTY_FORM);

  const qKey = ["/api/us-trading/broker/accounts", accountId, "trusted-contact"];

  const { data, isLoading, refetch } = useQuery<{ success: boolean; contact: TrustedContact | null }>({
    queryKey: qKey,
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${accountId}/trusted-contact`).then(r => r.json()),
    enabled: !!accountId,
    staleTime: 60_000,
  });

  const contact = data?.contact;

  const saveMutation = useMutation({
    mutationFn: (body: TrustedContact) =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/trusted-contact`, "POST", body),
    onSuccess: () => {
      toast({ title: contact ? "Trusted contact updated" : "Trusted contact added" });
      queryClient.invalidateQueries({ queryKey: qKey });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/trusted-contact`, "DELETE", {}),
    onSuccess: () => {
      toast({ title: "Trusted contact removed" });
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (e: any) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit() {
    setForm({
      given_name: contact?.given_name ?? "",
      family_name: contact?.family_name ?? "",
      email_address: contact?.email_address ?? "",
      phone_number: contact?.phone_number ?? "",
      city: contact?.city ?? "",
      state: contact?.state ?? "",
      postal_code: contact?.postal_code ?? "",
      country: contact?.country ?? "IND",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload: TrustedContact = {};
    if (form.given_name?.trim()) payload.given_name = form.given_name.trim();
    if (form.family_name?.trim()) payload.family_name = form.family_name.trim();
    if (form.email_address?.trim()) payload.email_address = form.email_address.trim();
    if (form.phone_number?.trim()) payload.phone_number = form.phone_number.trim();
    if (form.city?.trim()) payload.city = form.city.trim();
    if (form.state?.trim()) payload.state = form.state.trim();
    if (form.postal_code?.trim()) payload.postal_code = form.postal_code.trim();
    if (form.country?.trim()) payload.country = form.country.trim();
    saveMutation.mutate(payload);
  }

  const isFormValid =
    !!form.given_name?.trim() &&
    !!form.family_name?.trim() &&
    !!(form.email_address?.trim() || form.phone_number?.trim());

  if (!accountId) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Select an account to manage trusted contact.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Trusted Contact
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Required under FINRA Rule 4512 — a person the broker may contact to protect the account holder.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {contact ? (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={openEdit}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          ) : (
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openAdd}>
              <Plus className="h-3 w-3" /> Add Contact
            </Button>
          )}
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50/50 py-2">
        <Shield className="h-3.5 w-3.5 text-blue-600" />
        <AlertDescription className="text-xs text-blue-700">
          <strong>India note:</strong> Under FINRA Rule 4512, US brokers must attempt to obtain a trusted contact for each retail account. This person may be contacted in cases of possible financial exploitation, incapacitation, or when the broker cannot reach the account holder. The trusted contact does not receive any authority over the account.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : contact ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {contact.given_name} {contact.family_name}
                    </div>
                    <Badge variant="outline" className="text-xs mt-0.5">Trusted Contact</Badge>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {contact.email_address && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      {contact.email_address}
                    </div>
                  )}
                  {contact.phone_number && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {contact.phone_number}
                    </div>
                  )}
                  {(contact.city || contact.country) && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700 shrink-0"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove trusted contact?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove {contact.given_name} {contact.family_name} as the trusted contact for this account? The account will no longer have a trusted contact on file.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => deleteMutation.mutate()}
                    >
                      Remove Contact
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <UserCheck className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No trusted contact on file</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adding a trusted contact helps protect the account holder under FINRA Rule 4512.
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="h-3 w-3" /> Add Trusted Contact
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              {contact ? "Update" : "Add"} Trusted Contact
            </DialogTitle>
            <DialogDescription>
              Provide at least a name and one contact method (email or phone). This person has no authority over the account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name <span className="text-red-500">*</span></Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Rajiv"
                  value={form.given_name ?? ""}
                  onChange={e => setForm(f => ({ ...f, given_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name <span className="text-red-500">*</span></Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Mehta"
                  value={form.family_name ?? ""}
                  onChange={e => setForm(f => ({ ...f, family_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                className="h-8 text-sm"
                placeholder="rajiv@example.com"
                value={form.email_address ?? ""}
                onChange={e => setForm(f => ({ ...f, email_address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone Number</Label>
              <Input
                type="tel"
                className="h-8 text-sm"
                placeholder="+91 98765 43210"
                value={form.phone_number ?? ""}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Mumbai"
                  value={form.city ?? ""}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Maharashtra"
                  value={form.state ?? ""}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Postal Code</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="400001"
                  value={form.postal_code ?? ""}
                  onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Country</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="IND"
                  value={form.country ?? ""}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  maxLength={3}
                />
              </div>
            </div>
            {!form.email_address?.trim() && !form.phone_number?.trim() && (
              <p className="text-xs text-amber-600">At least one contact method (email or phone) is required.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!isFormValid || saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
              {contact ? "Update" : "Add"} Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
