import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download, Users, UserPlus, RefreshCw, AlertTriangle, CheckCircle2, Info, Database, ArrowRight, Cloud, Link2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ZohoConnection {
  id: string;
  services: string[];
  status: string;
  createdAt: string;
}

interface ImportPreview {
  contacts: { total: number; sample: any[] };
  leads: { total: number; sample: any[] };
  existingProspects: number;
  potentialDuplicates: number;
  environment: string;
  canImport: boolean;
  message: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: Array<{ email?: string; error: string }>;
  environment: string;
  wasActualImport: boolean;
  message: string;
}

interface SyncStatus {
  syncedFromZoho: number;
  syncedToZoho: number;
  pendingSync: number;
  lastSyncAt: string | null;
  environment: string;
  importEnabled: boolean;
}

export default function AdminZohoImportPage() {
  const { toast } = useToast();
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const { data: connections = [], isLoading: loadingConnections } = useQuery<ZohoConnection[]>({
    queryKey: ["/api/zoho/connections"]
  });

  const { data: agents = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/agents"]
  });

  const crmConnection = connections.find(c => c.services?.includes("CRM") && c.status === "active");

  const { data: preview, isLoading: loadingPreview, refetch: refetchPreview } = useQuery<ImportPreview>({
    queryKey: ["/api/zoho/crm/import/preview", selectedConnection],
    queryFn: async () => {
      const response = await fetch(`/api/zoho/crm/import/preview?connectionId=${selectedConnection}`);
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
    enabled: !!selectedConnection
  });

  const { data: syncStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/zoho/crm/import/status", selectedConnection],
    queryFn: async () => {
      const response = await fetch(`/api/zoho/crm/import/status?connectionId=${selectedConnection}`);
      if (!response.ok) throw new Error("Failed to fetch status");
      return response.json();
    },
    enabled: !!selectedConnection
  });

  const importContactsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/zoho/crm/import/contacts", {
        method: "POST",
        body: JSON.stringify({
          connectionId: selectedConnection,
          agentId: selectedAgentId,
          skipDuplicates: true
        }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data: ImportResult) => {
      toast({
        title: data.wasActualImport ? "Import Complete" : "Dry Run Complete",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zoho/crm/import/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zoho/crm/import/preview"] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const importLeadsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/zoho/crm/import/leads", {
        method: "POST",
        body: JSON.stringify({
          connectionId: selectedConnection,
          agentId: selectedAgentId,
          skipDuplicates: true
        }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data: ImportResult) => {
      toast({
        title: data.wasActualImport ? "Import Complete" : "Dry Run Complete",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/zoho/crm/import/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zoho/crm/import/preview"] });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const isProduction = preview?.environment === "production";
  const canImport = !!selectedConnection && !!selectedAgentId;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Zoho CRM Import</h1>
          <p className="text-muted-foreground">
            Import contacts and leads from Zoho CRM as FintekPro prospects
          </p>
        </div>
        <Badge variant={isProduction ? "default" : "secondary"} className="text-sm">
          {preview?.environment || "development"} mode
        </Badge>
      </div>

      {!isProduction && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Development Mode</AlertTitle>
          <AlertDescription>
            Import is in dry-run mode. Data will be fetched from Zoho but NOT saved to the database.
            Deploy to production to enable actual imports.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Connection Settings
            </CardTitle>
            <CardDescription>Select Zoho connection and agent for attribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Zoho CRM Connection</label>
              {loadingConnections ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading connections...
                </div>
              ) : connections.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No Zoho connections found. Please connect Zoho CRM in the integrations settings.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                  <SelectTrigger data-testid="select-zoho-connection">
                    <SelectValue placeholder="Select a connection" />
                  </SelectTrigger>
                  <SelectContent>
                    {connections
                      .filter(c => c.services?.includes("CRM"))
                      .map(conn => (
                        <SelectItem key={conn.id} value={conn.id}>
                          Zoho CRM ({conn.status}) - {format(new Date(conn.createdAt), "MMM d, yyyy")}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign Imported Prospects To</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger data-testid="select-agent">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.fullName || agent.name || agent.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All imported prospects will be assigned to this agent
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Status
            </CardTitle>
            <CardDescription>Current sync status between Zoho and FintekPro</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedConnection ? (
              <p className="text-sm text-muted-foreground">Select a connection to view status</p>
            ) : loadingStatus ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading status...
              </div>
            ) : syncStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{syncStatus.syncedFromZoho}</p>
                    <p className="text-sm text-muted-foreground">Imported from Zoho</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{syncStatus.syncedToZoho}</p>
                    <p className="text-sm text-muted-foreground">Exported to Zoho</p>
                  </div>
                </div>
                {syncStatus.lastSyncAt && (
                  <p className="text-sm text-muted-foreground">
                    Last sync: {format(new Date(syncStatus.lastSyncAt), "MMM d, yyyy h:mm a")}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchStatus()}
                  data-testid="btn-refresh-status"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {selectedConnection && (
        <Tabs defaultValue="preview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="preview">Import Preview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Import Preview</CardTitle>
                    <CardDescription>
                      Preview what will be imported from Zoho CRM
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPreview()}
                    disabled={loadingPreview}
                    data-testid="btn-refresh-preview"
                  >
                    {loadingPreview ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPreview ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : preview ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">Contacts</span>
                        </div>
                        <p className="text-3xl font-bold">{preview.contacts.total.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">in Zoho CRM</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <UserPlus className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Leads</span>
                        </div>
                        <p className="text-3xl font-bold">{preview.leads.total.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">in Zoho CRM</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="h-5 w-5 text-purple-600" />
                          <span className="font-medium">Existing</span>
                        </div>
                        <p className="text-3xl font-bold">{preview.existingProspects.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">FintekPro prospects</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <span className="font-medium">Duplicates</span>
                        </div>
                        <p className="text-3xl font-bold">{preview.potentialDuplicates}</p>
                        <p className="text-sm text-muted-foreground">will be skipped</p>
                      </div>
                    </div>

                    <Alert variant={preview.canImport ? "default" : "destructive"}>
                      {preview.canImport ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Info className="h-4 w-4" />
                      )}
                      <AlertDescription>{preview.message}</AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Unable to load preview</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Import Contacts
                    </CardTitle>
                    <CardDescription>
                      Import {preview?.contacts.total.toLocaleString() || 0} contacts from Zoho CRM
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => importContactsMutation.mutate()}
                    disabled={!canImport || importContactsMutation.isPending}
                    data-testid="btn-import-contacts"
                  >
                    {importContactsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isProduction ? "Importing..." : "Running..."}
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {isProduction ? "Import Contacts" : "Run Dry Import"}
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {preview?.contacts.sample && preview.contacts.sample.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sample of contacts to be imported:
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.contacts.sample.slice(0, 5).map((contact: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {[contact.First_Name, contact.Last_Name].filter(Boolean).join(" ") || "N/A"}
                            </TableCell>
                            <TableCell>{contact.Email || "N/A"}</TableCell>
                            <TableCell>{contact.Mobile || contact.Phone || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{contact.Lead_Source || "Unknown"}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No contacts available for preview</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Import Leads
                    </CardTitle>
                    <CardDescription>
                      Import {preview?.leads.total.toLocaleString() || 0} leads from Zoho CRM
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => importLeadsMutation.mutate()}
                    disabled={!canImport || importLeadsMutation.isPending}
                    data-testid="btn-import-leads"
                  >
                    {importLeadsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isProduction ? "Importing..." : "Running..."}
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {isProduction ? "Import Leads" : "Run Dry Import"}
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {preview?.leads.sample && preview.leads.sample.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sample of leads to be imported:
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.leads.sample.slice(0, 5).map((lead: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {[lead.First_Name, lead.Last_Name].filter(Boolean).join(" ") || "N/A"}
                            </TableCell>
                            <TableCell>{lead.Email || "N/A"}</TableCell>
                            <TableCell>{lead.Company || "N/A"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.Lead_Status || "Unknown"}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No leads available for preview</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
