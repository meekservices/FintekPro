import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: string;
  createdAt: string;
  actionType: string;
  actionSummary: string;
  rationale?: string;
  templateId?: string;
  riskDisclosure?: string;
}

interface AuditSummary {
  totalActions: number;
  actionBreakdown: Record<string, number>;
  complianceStatus: "COMPLIANT" | "FLAGGED" | "PENDING_REVIEW";
  riskDisclosuresPresent: boolean;
  logs: AuditLog[];
}

interface SEBIAuditExportProps {
  proposalId: string;
  isAdmin?: boolean;
}

const statusConfig = {
  COMPLIANT: { color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800", icon: CheckCircle2 },
  FLAGGED: { color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800", icon: AlertTriangle },
  PENDING_REVIEW: { color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: Clock },
};

export function SEBIAuditExport({ proposalId, isAdmin = false }: SEBIAuditExportProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: summary, isLoading, refetch } = useQuery<AuditSummary>({
    queryKey: ["/api/sebi-audit/summary", proposalId],
    queryFn: async () => {
      const response = await fetch(`/api/sebi-audit/summary/${proposalId}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: !!proposalId && isAdmin,
    staleTime: 60 * 1000,
  });

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/sebi-audit/export?proposalId=${proposalId}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sebi_audit_${proposalId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ title: "Audit log exported successfully" });
    } catch (error) {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportPDF = () => {
    // PDF export would use a PDF generation library
    toast({ title: "PDF export coming soon" });
  };

  if (!isAdmin) {
    return null; // Only show to admins
  }

  const filteredLogs = summary?.logs.filter(
    (log) =>
      log.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actionSummary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StatusIcon = summary ? statusConfig[summary.complianceStatus].icon : Clock;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              SEBI Audit Trail
            </CardTitle>
            <CardDescription>
              Regulatory compliance export (admin-only)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : summary ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{summary.totalActions}</div>
                <div className="text-xs text-muted-foreground">Total Actions</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">
                  {Object.keys(summary.actionBreakdown).length}
                </div>
                <div className="text-xs text-muted-foreground">Action Types</div>
              </div>
              <div className={cn(
                "p-3 rounded-lg text-center border",
                statusConfig[summary.complianceStatus].color
              )}>
                <StatusIcon className="h-5 w-5 mx-auto mb-1" />
                <div className="text-xs font-medium">{summary.complianceStatus}</div>
              </div>
              <div className={cn(
                "p-3 rounded-lg text-center",
                summary.riskDisclosuresPresent ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"
              )}>
                {summary.riskDisclosuresPresent ? (
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600" />
                )}
                <div className={cn(
                  "text-xs font-medium",
                  summary.riskDisclosuresPresent ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                )}>
                  {summary.riskDisclosuresPresent ? "Disclosures ✓" : "Missing"}
                </div>
              </div>
            </div>

            {/* Action breakdown */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Action Breakdown
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.actionBreakdown).map(([action, count]) => (
                  <Badge key={action} variant="outline" className="text-xs">
                    {action}: {count}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Log search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Logs table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="w-[100px]">Template</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs?.slice(0, 10).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[300px]">
                        {log.actionSummary}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.templateId || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredLogs || filteredLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredLogs && filteredLogs.length > 10 && (
              <p className="text-xs text-center text-muted-foreground">
                Showing 10 of {filteredLogs.length} logs. Export for full audit trail.
              </p>
            )}
          </>
        ) : (
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No audit logs available for this proposal.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SEBIAuditExport;
