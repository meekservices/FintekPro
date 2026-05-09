import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Wallet,
  IndianRupee,
  Users,
  Calendar,
  Download,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Building,
  Search,
  Filter,
  Settings,
  FileText,
  Send,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";

interface PayoutRequest {
  id: string;
  userId: string;
  userName: string;
  userType: 'agent' | 'partner' | 'ca';
  email: string;
  amount: number;
  requestDate: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bankName: string;
  accountEnding: string;
  ifsc: string;
  processedDate?: string;
  referenceNumber?: string;
  rejectionReason?: string;
  selected?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};


export default function AdminPayoutManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: payoutsData, isLoading } = useQuery<PayoutRequest[]>({
    queryKey: ['/api/admin/payouts'],
  });

  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  
  useEffect(() => {
    if (payoutsData) {
      setPayouts(payoutsData);
    }
  }, [payoutsData]);

  const metrics = useMemo(() => {
    const pendingCount = payouts.filter(p => p.status === 'pending').length;
    const pendingAmount = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    const approvedAmount = payouts.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0);
    const processingAmount = payouts.filter(p => p.status === 'processing').reduce((s, p) => s + p.amount, 0);
    const completedAmount = payouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    
    return {
      pendingCount,
      pendingAmount,
      approvedAmount,
      processingAmount,
      completedAmount,
      totalThisMonth: pendingAmount + approvedAmount + processingAmount
    };
  }, [payouts]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter(payout => {
      const matchesSearch = payout.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           payout.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           payout.userId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = userTypeFilter === "all" || payout.userType === userTypeFilter;
      const matchesTab = activeTab === "all" || payout.status === activeTab;
      return matchesSearch && matchesType && matchesTab;
    });
  }, [payouts, searchQuery, userTypeFilter, activeTab]);

  const togglePayoutSelection = (id: string) => {
    setSelectedPayouts(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    const pendingIds = filteredPayouts.filter(p => p.status === 'pending').map(p => p.id);
    setSelectedPayouts(pendingIds);
  };

  const handleBulkApprove = () => {
    toast({ title: "Payouts Approved", description: `${selectedPayouts.length} payouts have been approved` });
    setPayouts(payouts.map(p => 
      selectedPayouts.includes(p.id) ? { ...p, status: 'approved' as const } : p
    ));
    setSelectedPayouts([]);
    setShowApproveDialog(false);
  };

  const handleBulkReject = () => {
    if (!rejectionReason) {
      toast({ title: "Error", description: "Please provide a rejection reason", variant: "destructive" });
      return;
    }
    toast({ title: "Payouts Rejected", description: `${selectedPayouts.length} payouts have been rejected` });
    setPayouts(payouts.map(p => 
      selectedPayouts.includes(p.id) ? { ...p, status: 'rejected' as const, rejectionReason } : p
    ));
    setSelectedPayouts([]);
    setRejectionReason("");
    setShowRejectDialog(false);
  };

  const handleProcessPayouts = () => {
    const approvedPayouts = payouts.filter(p => p.status === 'approved');
    toast({ title: "Processing Started", description: `${approvedPayouts.length} payouts sent for bank transfer` });
    setPayouts(payouts.map(p => 
      p.status === 'approved' ? { ...p, status: 'processing' as const } : p
    ));
    setShowProcessDialog(false);
  };

  const handleSyncToZoho = () => {
    toast({ title: "Zoho Sync Started", description: "Payout data is being synced to Zoho Books" });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.pending;
  };

  const getUserTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      agent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      partner: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      ca: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  const selectedTotal = useMemo(() => {
    return payouts
      .filter(p => selectedPayouts.includes(p.id))
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payouts, selectedPayouts]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600">
              <Wallet className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Payout Management</h1>
              <p className="text-muted-foreground">Approve, process, and track all payouts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncToZoho} data-testid="button-sync-zoho">
              <RefreshCw className="w-4 h-4 mr-2" /> Sync to Zoho
            </Button>
            <Button variant="outline" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Approval</p>
                <p className="text-xl font-bold text-yellow-600">{formatCurrency(metrics.pendingAmount)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{metrics.pendingCount} requests</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(metrics.approvedAmount)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready to process</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Processing</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(metrics.processingAmount)}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">In bank queue</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(metrics.completedAmount)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Outflow</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.totalThisMonth)}</p>
              </div>
              <IndianRupee className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">All pending/processing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payout Requests</CardTitle>
              <CardDescription>Review and process payout requests</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[180px]"
                  data-testid="input-search"
                />
              </div>
              <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                <SelectTrigger className="w-[120px]" data-testid="select-user-type">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="agent">Agents</SelectItem>
                  <SelectItem value="partner">Partners</SelectItem>
                  <SelectItem value="ca">CAs</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending
                {metrics.pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1">{metrics.pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved">Approved</TabsTrigger>
              <TabsTrigger value="processing" data-testid="tab-processing">Processing</TabsTrigger>
              <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
              <TabsTrigger value="rejected" data-testid="tab-rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {activeTab === 'pending' && filteredPayouts.length > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={selectAllPending}>
                  Select All Pending
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedPayouts.length} selected ({formatCurrency(selectedTotal)})
                </span>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={selectedPayouts.length === 0}
                  onClick={() => setShowRejectDialog(true)}
                  className="text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:bg-red-950/30"
                  data-testid="button-bulk-reject"
                >
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button 
                  size="sm"
                  disabled={selectedPayouts.length === 0}
                  onClick={() => setShowApproveDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-bulk-approve"
                >
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          )}
          
          {activeTab === 'approved' && payouts.filter(p => p.status === 'approved').length > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm text-muted-foreground">
                {payouts.filter(p => p.status === 'approved').length} payouts ready for processing
              </span>
              <Button 
                onClick={() => setShowProcessDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-process-all"
              >
                <Send className="w-4 h-4 mr-2" /> Process All
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                {activeTab === 'pending' && <TableHead className="w-[50px]"></TableHead>}
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Request Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Bank Details</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayouts.map((payout) => (
                <TableRow key={payout.id} data-testid={`payout-row-${payout.id}`}>
                  {activeTab === 'pending' && (
                    <TableCell>
                      <Checkbox 
                        checked={selectedPayouts.includes(payout.id)}
                        onCheckedChange={() => togglePayoutSelection(payout.id)}
                        disabled={payout.status !== 'pending'}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <p className="font-medium">{payout.userName}</p>
                      <p className="text-xs text-muted-foreground">{payout.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getUserTypeBadge(payout.userType)}>{payout.userType}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(payout.requestDate), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(payout.amount)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{payout.bankName} ***{payout.accountEnding}</p>
                      <p className="text-xs text-muted-foreground">{payout.ifsc}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(payout.status)}>{payout.status}</Badge>
                    {payout.processedDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(payout.processedDate), 'dd MMM')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {payout.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:bg-green-50 dark:bg-green-950/30"
                          onClick={() => {
                            setSelectedPayouts([payout.id]);
                            setShowApproveDialog(true);
                          }}
                          data-testid={`button-approve-${payout.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 dark:bg-red-950/30"
                          onClick={() => {
                            setSelectedPayouts([payout.id]);
                            setShowRejectDialog(true);
                          }}
                          data-testid={`button-reject-${payout.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {payout.referenceNumber && (
                      <p className="text-xs text-muted-foreground">{payout.referenceNumber}</p>
                    )}
                    {payout.rejectionReason && (
                      <p className="text-xs text-red-500">{payout.rejectionReason}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredPayouts.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No payouts in this category</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payouts</DialogTitle>
            <DialogDescription>Confirm approval for selected payout requests</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">Selected Payouts</p>
              <p className="text-2xl font-bold text-green-600">{selectedPayouts.length} requests</p>
              <p className="font-medium">{formatCurrency(selectedTotal)}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Approved payouts will be queued for bank transfer processing.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-approve">
              Approve {selectedPayouts.length} Payouts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payouts</DialogTitle>
            <DialogDescription>Provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Rejecting</p>
              <p className="text-xl font-bold text-red-600">{selectedPayouts.length} requests</p>
              <p className="font-medium">{formatCurrency(selectedTotal)}</p>
            </div>
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Input 
                placeholder="e.g., Bank account verification failed"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkReject} variant="destructive" data-testid="button-confirm-reject">
              Reject {selectedPayouts.length} Payouts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Bank Transfers</DialogTitle>
            <DialogDescription>Initiate bank transfers for approved payouts</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">Ready for Transfer</p>
              <p className="text-2xl font-bold text-blue-600">
                {payouts.filter(p => p.status === 'approved').length} payouts
              </p>
              <p className="font-medium">{formatCurrency(metrics.approvedAmount)}</p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Transfers will be initiated via Cashfree Payout API</p>
              <p>• Processing typically takes 1-3 business days</p>
              <p>• Status will update automatically upon completion</p>
              <p>• Data will be synced to Zoho Books for reconciliation</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>Cancel</Button>
            <Button onClick={handleProcessPayouts} className="bg-blue-600 hover:bg-blue-700" data-testid="button-confirm-process">
              <Send className="w-4 h-4 mr-2" /> Initiate Transfers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
