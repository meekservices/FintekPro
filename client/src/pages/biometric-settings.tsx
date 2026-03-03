import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import {
  Fingerprint, Smartphone, ShieldCheck, ShieldAlert, Trash2,
  Pencil, Clock, CheckCircle2, XCircle, AlertTriangle, Plus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Credential {
  id: string;
  credentialId: string;
  deviceType: string | null;
  deviceName: string | null;
  backedUp: boolean | null;
  transports: string[] | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  event: string;
  deviceType: string | null;
  ipAddress: string | null;
  riskScore: number | null;
  stepUpRequired: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

const isWebAuthnSupported = () =>
  typeof window !== "undefined" &&
  !!window.PublicKeyCredential &&
  !!navigator.credentials;

const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function prepareRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: uint8ArrayToBase64url(new Uint8Array(credential.rawId)),
    type: credential.type,
    response: {
      clientDataJSON: uint8ArrayToBase64url(new Uint8Array(response.clientDataJSON)),
      attestationObject: uint8ArrayToBase64url(new Uint8Array(response.attestationObject)),
      transports: response.getTransports?.() ?? [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function prepareAuthenticationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: uint8ArrayToBase64url(new Uint8Array(credential.rawId)),
    type: credential.type,
    response: {
      clientDataJSON: uint8ArrayToBase64url(new Uint8Array(response.clientDataJSON)),
      authenticatorData: uint8ArrayToBase64url(new Uint8Array(response.authenticatorData)),
      signature: uint8ArrayToBase64url(new Uint8Array(response.signature)),
      userHandle: response.userHandle
        ? uint8ArrayToBase64url(new Uint8Array(response.userHandle))
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function eventBadge(event: string, success: boolean) {
  const labels: Record<string, string> = {
    registration_success: "Enrolled",
    registration_failure: "Enroll Failed",
    auth_success: "Login OK",
    auth_failure: "Login Failed",
    replay_blocked: "Replay Blocked",
    credential_deleted: "Removed",
  };
  const label = labels[event] || event;
  if (!success) return <Badge variant="destructive">{label}</Badge>;
  if (event === "replay_blocked") return <Badge className="bg-amber-500">{label}</Badge>;
  return <Badge className="bg-green-600">{label}</Badge>;
}

function riskBadge(score: number | null) {
  if (score === null) return null;
  if (score < 40) return <Badge variant="outline" className="text-green-600">Low Risk</Badge>;
  if (score < 70) return <Badge variant="outline" className="text-amber-600">Medium Risk</Badge>;
  return <Badge variant="outline" className="text-red-600">High Risk</Badge>;
}

export default function BiometricSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [renameTarget, setRenameTarget] = useState<Credential | null>(null);
  const [newName, setNewName] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: status } = useQuery<{ enrolled: boolean; sessionVerified: boolean }>({
    queryKey: ["/api/webauthn/status"],
  });

  const { data: credsData } = useQuery<{ credentials: Credential[] }>({
    queryKey: ["/api/webauthn/credentials"],
  });

  const { data: auditData } = useQuery<{ logs: AuditEntry[] }>({
    queryKey: ["/api/webauthn/audit-log"],
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiRequest(`/api/webauthn/credentials/${id}`, { method: "PATCH", body: { deviceName: name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/credentials"] });
      toast({ title: "Renamed", description: "Device name updated." });
      setRenameOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/webauthn/credentials/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/status"] });
      toast({ title: "Removed", description: "Biometric credential removed." });
      setDeleteTarget(null);
    },
  });

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      if (!platformAvailable) {
        toast({
          title: "Not Supported",
          description: "Your device does not have a platform authenticator (Face ID / Fingerprint) available.",
          variant: "destructive",
        });
        return;
      }

      const optionsRes = await apiRequest("/api/webauthn/register/options", { method: "POST" });

      const createOptions: CredentialCreationOptions = {
        publicKey: {
          ...optionsRes,
          challenge: base64urlToUint8Array(optionsRes.challenge),
          user: {
            ...optionsRes.user,
            id: base64urlToUint8Array(optionsRes.user.id),
          },
          excludeCredentials: (optionsRes.excludeCredentials ?? []).map((c: any) => ({
            ...c,
            id: base64urlToUint8Array(c.id),
          })),
        },
      };

      const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential;
      if (!credential) throw new Error("Credential creation cancelled");

      await apiRequest("/api/webauthn/register/verify", {
        method: "POST",
        body: prepareRegistrationCredential(credential),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/credentials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/status"] });
      toast({ title: "Biometric Enrolled", description: "Your device biometric has been registered successfully." });
      setEnrollOpen(false);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Biometric enrollment was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Enrollment Failed", description: err.message || "Could not enroll biometric.", variant: "destructive" });
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const optionsRes = await apiRequest("/api/webauthn/authenticate/options", { method: "POST" });

      const getOptions: CredentialRequestOptions = {
        publicKey: {
          ...optionsRes,
          challenge: base64urlToUint8Array(optionsRes.challenge),
          allowCredentials: (optionsRes.allowCredentials ?? []).map((c: any) => ({
            ...c,
            id: base64urlToUint8Array(c.id),
          })),
        },
      };

      const credential = await navigator.credentials.get(getOptions) as PublicKeyCredential;
      if (!credential) throw new Error("Authentication cancelled");

      const result = await apiRequest("/api/webauthn/authenticate/verify", {
        method: "POST",
        body: prepareAuthenticationCredential(credential),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/webauthn/audit-log"] });
      toast({
        title: "Biometric Verified",
        description: `Authentication successful. Risk level: ${result.risk?.level ?? "low"}.`,
      });
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast({ title: "Cancelled", description: "Biometric test was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Test Failed", description: err.message || "Biometric verification failed.", variant: "destructive" });
      }
    } finally {
      setTesting(false);
    }
  };

  const credentials = credsData?.credentials ?? [];
  const auditLogs = auditData?.logs ?? [];

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
          <Fingerprint className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Biometric Authentication</h1>
          <p className="text-muted-foreground text-sm">
            Use Face ID or Fingerprint for secure, passwordless sign-in
          </p>
        </div>
      </div>

      {!isWebAuthnSupported() && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your browser does not support biometric authentication. Please use a modern browser on a compatible device.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Security Status</CardTitle>
              <CardDescription>Current biometric authentication state</CardDescription>
            </div>
            {status?.enrolled ? (
              <Badge className="bg-green-600 gap-1">
                <ShieldCheck className="h-3 w-3" /> Protected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <ShieldAlert className="h-3 w-3" /> Not Enrolled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => setEnrollOpen(true)} className="flex-1 gap-2" disabled={!isWebAuthnSupported()}>
            <Plus className="h-4 w-4" /> Add Biometric Device
          </Button>
          {status?.enrolled && (
            <Button variant="outline" onClick={handleTest} disabled={testing} className="flex-1 gap-2">
              <Fingerprint className="h-4 w-4" />
              {testing ? "Verifying..." : "Test Biometric"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="devices">
        <ScrollableTabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices">Enrolled Devices ({credentials.length})</TabsTrigger>
          <TabsTrigger value="audit">Activity Log</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="devices" className="mt-4 space-y-3">
          {credentials.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No biometric devices enrolled</p>
                <p className="text-sm mt-1">Add your device to enable Face ID or Fingerprint login</p>
              </CardContent>
            </Card>
          ) : (
            credentials.map((cred) => (
              <Card key={cred.id}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="p-2 rounded-full bg-blue-50 dark:bg-blue-950">
                    <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {cred.deviceName || cred.deviceType || "Biometric Device"}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                      <span>Added {formatDistanceToNow(new Date(cred.createdAt), { addSuffix: true })}</span>
                      {cred.lastUsedAt && (
                        <span>· Last used {formatDistanceToNow(new Date(cred.lastUsedAt), { addSuffix: true })}</span>
                      )}
                      {cred.backedUp && <span>· Cloud backed up</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => { setRenameTarget(cred); setNewName(cred.deviceName || ""); setRenameOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(cred)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4 space-y-2">
          {auditLogs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No activity yet</p>
              </CardContent>
            </Card>
          ) : (
            auditLogs.slice().reverse().map((log) => (
              <Card key={log.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <div className="mt-0.5">
                    {log.success
                      ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                      : <XCircle className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {eventBadge(log.event, log.success)}
                      {riskBadge(log.riskScore)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                      {log.failureReason && ` · ${log.failureReason}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" /> Enroll Biometric Device
            </DialogTitle>
            <DialogDescription>
              Your device will prompt you to use Face ID, Fingerprint, or PIN. Your biometric data
              never leaves your device — only a cryptographic key is stored securely.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-sm space-y-2">
            <div className="font-medium text-blue-700 dark:text-blue-300">SEBI-compliant security</div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>Private key stored only on your device (Secure Enclave)</li>
              <li>Replay attack protection via counter validation</li>
              <li>Risk-based step-up authentication for high-value transactions</li>
              <li>Full immutable audit trail</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={handleEnroll} disabled={enrolling} className="gap-2">
              <Fingerprint className="h-4 w-4" />
              {enrolling ? "Waiting for device..." : "Enroll Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Device</DialogTitle>
            <DialogDescription>Give this device a recognisable name.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. iPhone 15 Pro, MacBook"
            onKeyDown={(e) => e.key === "Enter" && renameTarget && renameMutation.mutate({ id: renameTarget.id, name: newName })}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              onClick={() => renameTarget && renameMutation.mutate({ id: renameTarget.id, name: newName })}
              disabled={!newName.trim() || renameMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Biometric Device?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the biometric credential for{" "}
              <strong>{deleteTarget?.deviceName || deleteTarget?.deviceType || "this device"}</strong>.
              You will no longer be able to sign in using this device's biometric.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
