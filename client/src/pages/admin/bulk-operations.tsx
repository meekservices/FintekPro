import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Package, 
  Shield as LucideShield, 
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Upload,
  Download,
  RefreshCw,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BulkOperation {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  createdAt: string;
  completedAt?: string;
  createdBy: string;
  description: string;
}

interface BulkOperationsData {
  operations: BulkOperation[];
  stats: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
}

const operationTypeLabels: Record<string, string> = {
  user_export: 'User Export',
  user_status_update: 'User Status Update',
  kyc_verification: 'KYC Bulk Verification',
  product_update: 'Product Update',
  notification_send: 'Bulk Notification',
  data_cleanup: 'Data Cleanup',
};

export default function BulkOperations() {
  const { toast } = useToast();
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");

  const { data, isLoading, refetch } = useQuery<BulkOperationsData>({
    queryKey: ["/api/admin/bulk-operations"],
  });

  const startOperationMutation = useMutation({
    mutationFn: async (operationType: string) => {
      return await apiRequest('/api/admin/bulk-operations', {
        method: 'POST',
        body: JSON.stringify({ 
          type: operationType,
          userIds: Array.from(selectedUsers)
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Operation Started", description: "Bulk operation has been queued" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bulk-operations"] });
      setSelectedUsers(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200';
      case 'running': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
      case 'failed': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'paused': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bulk Operations Center</h1>
          <p className="text-sm text-muted-foreground">
            Batch processing for users, products, and system operations
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{data?.stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600" />
              Running
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{data?.stats?.running || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{data?.stats?.completed || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{data?.stats?.failed || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList>
          <TabsTrigger value="new" data-testid="tab-new">New Operation</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Operation History</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:border-blue-500 transition-colors" onClick={() => startOperationMutation.mutate('user_export')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Export Users
                </CardTitle>
                <CardDescription>Export user data to CSV/Excel</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" data-testid="button-export-users">
                  <Download className="w-4 h-4 mr-2" />
                  Start Export
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-emerald-500 transition-colors" onClick={() => startOperationMutation.mutate('kyc_verification')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideShield className="w-5 h-5 text-emerald-600" />
                  Bulk KYC Verify
                </CardTitle>
                <CardDescription>Process pending KYC verifications</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-kyc-verify">
                  <LucideShield className="w-4 h-4 mr-2" />
                  Start Verification
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-purple-500 transition-colors" onClick={() => startOperationMutation.mutate('notification_send')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Bulk Notifications
                </CardTitle>
                <CardDescription>Send notifications to user groups</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-notifications">
                  <Upload className="w-4 h-4 mr-2" />
                  Configure & Send
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-orange-500 transition-colors" onClick={() => startOperationMutation.mutate('user_status_update')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-600" />
                  Update User Status
                </CardTitle>
                <CardDescription>Bulk activate/deactivate users</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-user-status">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update Status
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-cyan-500 transition-colors" onClick={() => startOperationMutation.mutate('product_update')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-cyan-600" />
                  Product Updates
                </CardTitle>
                <CardDescription>Bulk update product pricing/status</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" data-testid="button-product-update">
                  <Package className="w-4 h-4 mr-2" />
                  Update Products
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-red-500 transition-colors" onClick={() => startOperationMutation.mutate('data_cleanup')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Data Cleanup
                </CardTitle>
                <CardDescription>Clean stale/orphaned records</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="destructive" data-testid="button-cleanup">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Start Cleanup
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Operations</CardTitle>
              <CardDescription>History of bulk operations with progress tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data?.operations || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No bulk operations yet</p>
                  </div>
                ) : (
                  (data?.operations || []).map((op) => (
                    <div 
                      key={op.id} 
                      className="p-4 border rounded-lg"
                      data-testid={`operation-${op.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={getStatusColor(op.status)}>
                            {getStatusIcon(op.status)}
                            <span className="ml-1 capitalize">{op.status}</span>
                          </Badge>
                          <span className="font-medium">{operationTypeLabels[op.type] || op.type}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(op.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{op.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Progress</span>
                          <span>{op.processedItems} / {op.totalItems} items</span>
                        </div>
                        <Progress value={op.progress} />
                        {op.failedItems > 0 && (
                          <p className="text-sm text-red-600">
                            {op.failedItems} items failed
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-4">
                        {op.status === 'running' && (
                          <Button size="sm" variant="outline">
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        )}
                        {op.status === 'paused' && (
                          <Button size="sm" variant="outline">
                            <Play className="w-4 h-4 mr-1" />
                            Resume
                          </Button>
                        )}
                        {op.status === 'completed' && (
                          <Button size="sm" variant="outline">
                            <Download className="w-4 h-4 mr-1" />
                            Download Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
