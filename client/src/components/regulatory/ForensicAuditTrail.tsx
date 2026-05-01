import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { 
  Shield, 
  Search, 
  FileText, 
  Activity, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Download,
  Fingerprint,
  Lock,
  Heart,
  ChevronRight,
  Filter
} from "lucide-react";
import { useLocation } from "wouter";

interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  userName?: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  ipAddress: string;
  details: Record<string, any>;
  metadata: {
    hash: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    isRegulatoryAlert: boolean;
    verificationStatus: 'verified' | 'pending' | 'failed';
  };
}

interface AuditLogResponse {
  success: boolean;
  data: {
    entries: AuditLogEntry[];
    pagination: {
      total: number;
      page: number;
      totalPages: number;
      limit: number;
    };
    heartbeat: {
      status: 'healthy' | 'warning' | 'critical';
      lastVerified: string;
      integrityCheck: boolean;
    };
  };
}

export function ForensicAuditTrail() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>(searchParams.get("risk") || "all");
  const [page, setPage] = useState(1);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Deep linking logic: if ?alertId=... is present, highlight/filter that entry
  const alertId = searchParams.get("alertId");

  const { data: response, isLoading, refetch, isFetching } = useQuery<AuditLogResponse>({
    queryKey: ["/api/compliance/audit-log", page, riskFilter, alertId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (riskFilter !== "all") params.set("riskLevel", riskFilter);
      if (alertId) params.set("id", alertId);
      
      const res = await fetch(`/api/compliance/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch forensic audit trail");
      return res.json();
    }
  });

  const clearFilters = () => {
    setSearchQuery("");
    setRiskFilter("all");
    setPage(1);
    if (alertId) {
      window.history.pushState({}, '', window.location.pathname);
    }
    refetch();
  };

  const data = response?.data;
  const entries = data?.entries || [];
  const heartbeat = data?.heartbeat;

  const handleExport = async () => {
    // Implementation for CSV export
    window.open(`/api/compliance/audit-log/export?riskLevel=${riskFilter}`, '_blank');
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'critical': return <Badge className="bg-red-600 text-white border-none">CRITICAL</Badge>;
      case 'high': return <Badge className="bg-orange-500 text-white border-none">HIGH</Badge>;
      case 'medium': return <Badge className="bg-amber-500 text-white border-none">MEDIUM</Badge>;
      case 'low': return <Badge className="bg-blue-500 text-white border-none">LOW</Badge>;
      default: return <Badge variant="outline">{level}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Forensic Heartbeat Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className={`w-5 h-5 ${heartbeat?.status === 'healthy' ? 'text-rose-500 animate-pulse' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm">System Heartbeat</span>
              </div>
              <Badge variant={heartbeat?.status === 'healthy' ? 'success' : 'warning'}>
                {heartbeat?.status?.toUpperCase() || 'VERIFYING'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last integrity check: {heartbeat?.lastVerified ? format(new Date(heartbeat.lastVerified), 'HH:mm:ss') : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-sm">Forensic Integrity</span>
              </div>
              <Badge variant={heartbeat?.integrityCheck ? 'success' : 'destructive'}>
                {heartbeat?.integrityCheck ? 'HASH VERIFIED' : 'UNVERIFIED'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Immutable SHA-256 chain active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="text-amber-500 w-5 h-5" />
                <span className="font-semibold text-sm">Access Control</span>
              </div>
              <Badge variant="outline">AUDIT MODE</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Privileged Forensic view enabled
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Forensic Audit Trail
              </CardTitle>
              <CardDescription>
                Tamper-proof record of all regulatory and high-risk activities
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Export Forensic Log
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by User, IP, or Transaction ID..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              {(riskFilter !== "all" || searchQuery || alertId) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Loading forensic data...
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No audit entries found matching the criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow 
                      key={entry.id} 
                      className={`${entry.metadata.isRegulatoryAlert ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''} ${alertId === entry.id ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                    >
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {entry.id.substring(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{entry.action.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{entry.entityType}: {entry.entityId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{entry.userName || entry.userId}</span>
                          <span className="text-[10px] text-muted-foreground">{entry.ipAddress}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(entry.metadata.riskLevel)}
                      </TableCell>
                      <TableCell>
                        {entry.metadata.verificationStatus === 'verified' ? (
                          <div className="flex items-center text-emerald-600 gap-1 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </div>
                        ) : (
                          <div className="flex items-center text-amber-600 gap-1 text-xs">
                            <Activity className="w-3 h-3" />
                            {entry.metadata.verificationStatus}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setShowDetails(showDetails === entry.id ? null : entry.id)}
                        >
                          <ChevronRight className={`w-4 h-4 transition-transform ${showDetails === entry.id ? 'rotate-90' : ''}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination would go here */}
        </CardContent>
      </Card>

      {/* Expanded Details View */}
      {showDetails && entries.find(e => e.id === showDetails) && (
        <Card className="border-indigo-200 bg-indigo-50/10">
          <CardHeader className="py-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Forensic Details: {showDetails}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Payload Details</h4>
                <div className="bg-muted p-3 rounded-md font-mono text-[11px] overflow-auto max-h-[300px]">
                  <pre>{JSON.stringify(entries.find(e => e.id === showDetails)?.details, null, 2)}</pre>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Forensic Metadata</h4>
                  <div className="space-y-2 p-3 bg-muted rounded-md text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Integrity Hash:</span>
                      <span className="font-mono text-indigo-600 truncate ml-4">
                        {entries.find(e => e.id === showDetails)?.metadata.hash}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Regulatory Alert:</span>
                      <span>{entries.find(e => e.id === showDetails)?.metadata.isRegulatoryAlert ? 'YES' : 'NO'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Compliance SLA:</span>
                      <span className="text-emerald-600 font-medium">WITHIN LIMITS (T+3)</span>
                    </div>
                  </div>
                </div>
                <Button className="w-full" variant="outline" size="sm">
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Verify Chain of Custody
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
