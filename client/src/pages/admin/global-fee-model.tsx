import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Settings, Sparkles, Zap, Calculator, LucideShield as LucideShield, AlertTriangle,
  TrendingUp, Users, History, Download, RefreshCw, Save, 
  CheckCircle, XCircle, Edit, Eye, BarChart2
} from "lucide-react";

interface AdminSettings {
  id: number;
  enablePlatformOnlyMode: boolean;
  allowClientSelfSelection: boolean;
  defaultFeeMode: 'ADVISORY_PLATFORM' | 'PLATFORM_ONLY';
  advisoryFeeBps: number;
  platformFeeBps: number;
  advisoryFeeCapInr: number | null;
  platformFeeCapInr: number | null;
  policyVersion: number;
  lastUpdatedBy: string | null;
  updatedAt: string;
}

interface FeeModeStats {
  totalClients: number;
  advisoryPlatformCount: number;
  platformOnlyCount: number;
  notSelectedCount: number;
  modeChangesLast30Days: number;
  avgOrderValueAdvisory: number;
  avgOrderValuePlatform: number;
}

interface AuditEntry {
  id: number;
  clientId: string;
  action: string;
  previousMode: string | null;
  newMode: string | null;
  reason: string | null;
  performedBy: string;
  ipAddress: string | null;
  timestamp: string;
}

export default function GlobalFeeModelAdmin() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("settings");
  const [isEditing, setIsEditing] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideMode, setOverrideMode] = useState<'ADVISORY_PLATFORM' | 'PLATFORM_ONLY'>('ADVISORY_PLATFORM');

  const [editedSettings, setEditedSettings] = useState<Partial<AdminSettings>>({});

  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery<{ success: boolean; settings: AdminSettings }>({
    queryKey: ["/api/fee-mode/admin/settings"]
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; statistics: FeeModeStats }>({
    queryKey: ["/api/fee-mode/admin/statistics"]
  });

  const { data: auditData, isLoading: auditLoading } = useQuery<{ success: boolean; auditLog: AuditEntry[] }>({
    queryKey: ["/api/fee-mode/admin/audit-log"]
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<AdminSettings>) => {
      const response = await apiRequest("PUT", "/api/fee-mode/admin/settings", settings);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Updated", description: "Fee model policy has been saved successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-mode/admin"] });
      setIsEditing(false);
      refetchSettings();
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });

  const overrideModeMutation = useMutation({
    mutationFn: async (data: { clientId: string; newMode: string; reason: string }) => {
      const response = await apiRequest("POST", "/api/fee-mode/admin/override", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Override Applied", description: "Client fee mode has been changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-mode/admin"] });
      setOverrideDialogOpen(false);
      setSelectedClient("");
      setOverrideReason("");
    },
    onError: (error: any) => {
      toast({ title: "Override Failed", description: error.message, variant: "destructive" });
    }
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(editedSettings);
  };

  const handleOverride = () => {
    if (overrideReason.length < 10) {
      toast({ title: "Invalid Reason", description: "Please provide at least 10 characters.", variant: "destructive" });
      return;
    }
    overrideModeMutation.mutate({
      clientId: selectedClient,
      newMode: overrideMode,
      reason: overrideReason
    });
  };

  const settings = settingsData?.settings;
  const stats = statsData?.statistics;
  const auditLog = auditData?.auditLog || [];

  if (settingsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="global-fee-model-admin">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Global Investments Fee Model
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure Advisory + Platform vs Platform-Only fee structures
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchSettings()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Advisory + Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.advisoryPlatformCount}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalClients > 0 ? ((stats.advisoryPlatformCount / stats.totalClients) * 100).toFixed(1) : 0}% of clients
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <Zap className="h-4 w-4 text-blue-500" />
                Platform-Only
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.platformOnlyCount}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalClients > 0 ? ((stats.platformOnlyCount / stats.totalClients) * 100).toFixed(1) : 0}% of clients
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Not Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.notSelectedCount}</div>
              <p className="text-xs text-muted-foreground">Pending selection</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Policy Settings
          </TabsTrigger>
          <TabsTrigger value="fees">
            <Calculator className="h-4 w-4 mr-2" />
            Fee Structure
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Mode Policy</CardTitle>
                  <CardDescription>
                    Control fee model availability and client selection rules
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Version {settings?.policyVersion || 1}</Badge>
                  {!isEditing ? (
                    <Button onClick={() => {
                      setIsEditing(true);
                      setEditedSettings(settings || {});
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Policy
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>
                        <Save className="h-4 w-4 mr-2" />
                        {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Enable Platform-Only Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow clients to choose execution-only access without advisory
                      </p>
                    </div>
                    <Switch
                      checked={isEditing ? (editedSettings.enablePlatformOnlyMode ?? settings?.enablePlatformOnlyMode) : settings?.enablePlatformOnlyMode}
                      disabled={!isEditing}
                      onCheckedChange={(checked) => setEditedSettings(prev => ({ ...prev, enablePlatformOnlyMode: checked }))}
                      data-testid="switch-platform-only-mode"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label className="text-base font-medium">Allow Client Self-Selection</Label>
                      <p className="text-sm text-muted-foreground">
                        Let clients change their fee mode independently
                      </p>
                    </div>
                    <Switch
                      checked={isEditing ? (editedSettings.allowClientSelfSelection ?? settings?.allowClientSelfSelection) : settings?.allowClientSelfSelection}
                      disabled={!isEditing}
                      onCheckedChange={(checked) => setEditedSettings(prev => ({ ...prev, allowClientSelfSelection: checked }))}
                      data-testid="switch-self-selection"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <Label className="text-base font-medium">Default Fee Mode</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Applied to new clients who haven't made a selection
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant={(isEditing ? editedSettings.defaultFeeMode : settings?.defaultFeeMode) === 'ADVISORY_PLATFORM' ? 'default' : 'outline'}
                        className="flex-1"
                        disabled={!isEditing}
                        onClick={() => setEditedSettings(prev => ({ ...prev, defaultFeeMode: 'ADVISORY_PLATFORM' }))}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Advisory + Platform
                      </Button>
                      <Button
                        variant={(isEditing ? editedSettings.defaultFeeMode : settings?.defaultFeeMode) === 'PLATFORM_ONLY' ? 'default' : 'outline'}
                        className="flex-1"
                        disabled={!isEditing}
                        onClick={() => setEditedSettings(prev => ({ ...prev, defaultFeeMode: 'PLATFORM_ONLY' }))}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Platform-Only
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {settings?.lastUpdatedBy && (
                <Alert>
                  <LucideShield className="h-4 w-4" />
                  <AlertTitle>Last Updated</AlertTitle>
                  <AlertDescription>
                    Policy v{settings.policyVersion} was last modified on {format(new Date(settings.updatedAt), 'PPpp')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Fee Structure Configuration</CardTitle>
              <CardDescription>
                Set advisory and platform fees in basis points (bps). 100 bps = 1%
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg space-y-4 bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">Advisory Fee</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Fee Rate (basis points)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={isEditing ? (editedSettings.advisoryFeeBps ?? settings?.advisoryFeeBps) : settings?.advisoryFeeBps}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, advisoryFeeBps: parseInt(e.target.value) || 0 }))}
                          disabled={!isEditing}
                          className="w-24"
                          data-testid="input-advisory-bps"
                        />
                        <span className="text-sm text-muted-foreground">
                          bps = {((isEditing ? (editedSettings.advisoryFeeBps ?? settings?.advisoryFeeBps ?? 0) : settings?.advisoryFeeBps ?? 0) / 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label>Fee Cap (INR, optional)</Label>
                      <Input
                        type="number"
                        value={(isEditing ? editedSettings.advisoryFeeCapInr : settings?.advisoryFeeCapInr) ?? ''}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, advisoryFeeCapInr: e.target.value ? parseInt(e.target.value) : null }))}
                        disabled={!isEditing}
                        placeholder="No cap"
                        className="w-32 mt-1"
                        data-testid="input-advisory-cap"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-4 bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Platform Fee</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Fee Rate (basis points)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={isEditing ? (editedSettings.platformFeeBps ?? settings?.platformFeeBps) : settings?.platformFeeBps}
                          onChange={(e) => setEditedSettings(prev => ({ ...prev, platformFeeBps: parseInt(e.target.value) || 0 }))}
                          disabled={!isEditing}
                          className="w-24"
                          data-testid="input-platform-bps"
                        />
                        <span className="text-sm text-muted-foreground">
                          bps = {((isEditing ? (editedSettings.platformFeeBps ?? settings?.platformFeeBps ?? 0) : settings?.platformFeeBps ?? 0) / 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label>Fee Cap (INR, optional)</Label>
                      <Input
                        type="number"
                        value={(isEditing ? editedSettings.platformFeeCapInr : settings?.platformFeeCapInr) ?? ''}
                        onChange={(e) => setEditedSettings(prev => ({ ...prev, platformFeeCapInr: e.target.value ? parseInt(e.target.value) : null }))}
                        disabled={!isEditing}
                        placeholder="No cap"
                        className="w-32 mt-1"
                        data-testid="input-platform-cap"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Fee Calculator Preview</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Order Value:</span>
                    <span className="font-mono ml-2">₹1,00,000</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Advisory + Platform:</span>
                    <span className="font-mono ml-2 text-amber-600">
                      ₹{((100000 * ((settings?.advisoryFeeBps || 25) + (settings?.platformFeeBps || 10))) / 10000).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Platform-Only:</span>
                    <span className="font-mono ml-2 text-blue-600">
                      ₹{((100000 * (settings?.platformFeeBps || 10)) / 10000).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fee Mode Audit Log</CardTitle>
                  <CardDescription>
                    Immutable record of all fee mode changes for SEBI compliance
                  </CardDescription>
                </div>
                <Button variant="outline" disabled>
                  <Download className="h-4 w-4 mr-2" />
                  Export for SEBI
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : auditLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No audit entries yet
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Previous</TableHead>
                        <TableHead>New</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLog.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">
                            {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.clientId.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant={entry.action === 'ADMIN_OVERRIDE' ? 'destructive' : 'secondary'}>
                              {entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {entry.previousMode ? (
                              <Badge variant="outline">{entry.previousMode}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {entry.newMode ? (
                              <Badge>{entry.newMode}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-xs">{entry.performedBy}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {entry.reason || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Override - Fee Mode</DialogTitle>
            <DialogDescription>
              Override a client's fee mode selection. This action is logged for SEBI compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Client ID</Label>
              <Input
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                placeholder="Enter client ID"
                data-testid="input-override-client"
              />
            </div>
            <div>
              <Label>New Fee Mode</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={overrideMode === 'ADVISORY_PLATFORM' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setOverrideMode('ADVISORY_PLATFORM')}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Advisory
                </Button>
                <Button
                  variant={overrideMode === 'PLATFORM_ONLY' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setOverrideMode('PLATFORM_ONLY')}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Platform-Only
                </Button>
              </div>
            </div>
            <div>
              <Label>Reason (min 10 characters)</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Provide justification for this override..."
                data-testid="input-override-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleOverride} disabled={overrideModeMutation.isPending}>
              {overrideModeMutation.isPending ? "Applying..." : "Apply Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
