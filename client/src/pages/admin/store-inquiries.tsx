import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  MessageSquare,
  Search,
  Filter,
  Eye,
  CheckCircle,
  Clock,
  Phone,
  Mail,
  User,
  Calendar,
  RefreshCw,
  Send,
  FileText,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Inquiry {
  id: string;
  categoryId?: string;
  categoryName?: string;
  productId?: string;
  productName?: string;
  userId?: number;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  inquiryType: string;
  status: 'pending' | 'contacted' | 'resolved' | 'cancelled';
  assignedTo?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground"
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  contacted: Phone,
  resolved: CheckCircle,
  cancelled: AlertCircle
};

export default function AdminStoreInquiriesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inquiriesData, isLoading, refetch } = useQuery<{
    success: boolean;
    inquiries: Inquiry[];
    count: number;
  }>({
    queryKey: ["/api/admin/store/inquiries"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      return apiRequest(`/api/admin/store/inquiries/${id}/status`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/store/inquiries"] });
      toast({ title: "Status Updated", description: "Inquiry status has been updated successfully." });
      setIsDetailDialogOpen(false);
      setSelectedInquiry(null);
      setResponseNote("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Update Failed", 
        description: error.message || "Failed to update inquiry status",
        variant: "destructive"
      });
    }
  });

  const inquiries = inquiriesData?.inquiries || [];

  const filteredInquiries = inquiries.filter(inquiry => {
    const matchesSearch = 
      inquiry.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || inquiry.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: inquiries.length,
    pending: inquiries.filter(i => i.status === 'pending').length,
    contacted: inquiries.filter(i => i.status === 'contacted').length,
    resolved: inquiries.filter(i => i.status === 'resolved').length
  };

  const handleViewDetails = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setResponseNote(inquiry.adminNotes || "");
    setIsDetailDialogOpen(true);
  };

  const handleUpdateStatus = (status: string) => {
    if (!selectedInquiry) return;
    updateStatusMutation.mutate({
      id: selectedInquiry.id,
      status,
      adminNotes: responseNote
    });
  };

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-purple-600" />
              Store Inquiries Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage product and category inquiries from clients
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 dark:text-purple-400">Total Inquiries</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Contacted</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.contacted}</p>
                </div>
                <Phone className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 dark:text-green-400">Resolved</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inquiry List</CardTitle>
                <CardDescription>Track and manage product/category inquiries</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : filteredInquiries.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No inquiries found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Category/Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInquiries.map((inquiry) => {
                    const StatusIcon = statusIcons[inquiry.status] || Clock;
                    return (
                      <TableRow key={inquiry.id} data-testid={`row-inquiry-${inquiry.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <User className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{inquiry.name}</p>
                              <p className="text-sm text-muted-foreground">{inquiry.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {inquiry.categoryName && (
                              <Badge variant="outline" className="mr-2">{inquiry.categoryName}</Badge>
                            )}
                            {inquiry.productName && (
                              <span className="text-sm text-muted-foreground">{inquiry.productName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{inquiry.inquiryType || 'general'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[inquiry.status]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {inquiry.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(inquiry.createdAt), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(inquiry)}
                            data-testid={`button-view-${inquiry.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Inquiry Details
              </DialogTitle>
              <DialogDescription>
                Review and respond to this inquiry
              </DialogDescription>
            </DialogHeader>
            {selectedInquiry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Contact Name</p>
                    <p className="font-medium">{selectedInquiry.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${selectedInquiry.email}`} className="font-medium text-blue-600 hover:underline">
                      {selectedInquiry.email}
                    </a>
                  </div>
                  {selectedInquiry.phone && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a href={`tel:${selectedInquiry.phone}`} className="font-medium text-blue-600 hover:underline">
                        {selectedInquiry.phone}
                      </a>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Inquiry Type</p>
                    <Badge variant="secondary">{selectedInquiry.inquiryType || 'general'}</Badge>
                  </div>
                  {selectedInquiry.categoryName && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Category</p>
                      <Badge variant="outline">{selectedInquiry.categoryName}</Badge>
                    </div>
                  )}
                  {selectedInquiry.productName && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-medium">{selectedInquiry.productName}</p>
                    </div>
                  )}
                </div>

                {selectedInquiry.message && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Message</p>
                    <p className="p-3 bg-muted rounded-lg text-sm">
                      {selectedInquiry.message}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Admin Notes / Response</p>
                  <Textarea
                    placeholder="Add notes or response..."
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    rows={3}
                    data-testid="textarea-admin-notes"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Update Status</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={selectedInquiry.status === 'contacted' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus('contacted')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-status-contacted"
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      Mark Contacted
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedInquiry.status === 'resolved' ? 'default' : 'outline'}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleUpdateStatus('resolved')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-status-resolved"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-muted-foreground"
                      onClick={() => handleUpdateStatus('cancelled')}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-status-cancelled"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
