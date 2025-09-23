import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart,
  FileText,
  DollarSign,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  Calendar,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProposalItem {
  id: string;
  productType: 'mutual_fund' | 'equity' | 'bond' | 'ipo' | 'insurance' | 'loan';
  productId: string;
  productName: string;
  amount: number;
  units?: number;
  rate?: number;
  duration?: string;
  frequency?: string;
  notes?: string;
}

interface Proposal {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  totalAmount: number;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  items: ProposalItem[];
  advisorName: string;
  advisorEmail: string;
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800", 
  viewed: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600"
};

const statusIcons = {
  draft: Clock,
  sent: FileText,
  viewed: Eye,
  accepted: CheckCircle,
  rejected: AlertCircle,
  expired: AlertCircle
};

const statusDescriptions = {
  draft: "Being prepared by your advisor",
  sent: "Sent to you for review",
  viewed: "You have reviewed this proposal",
  accepted: "You have accepted this proposal",
  rejected: "You have declined this proposal",
  expired: "This proposal has expired"
};

export default function ClientProposalsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's proposals
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ['/api/proposals'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/proposals');
      return await response.json() as Proposal[];
    }
  });

  // Accept proposal mutation
  const acceptProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('PUT', `/api/proposals/${proposalId}/accept`);
      return await response.json();
    },
    onSuccess: (data, proposalId) => {
      const proposal = proposals.find(p => p.id === proposalId);
      toast({
        title: "Proposal accepted",
        description: `You have accepted "${proposal?.title}". It can now be added to your cart.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to accept proposal",
        description: "Please try again."
      });
    }
  });

  // Reject proposal mutation
  const rejectProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('PUT', `/api/proposals/${proposalId}/reject`);
      return await response.json();
    },
    onSuccess: (data, proposalId) => {
      const proposal = proposals.find(p => p.id === proposalId);
      toast({
        title: "Proposal declined",
        description: `You have declined "${proposal?.title}".`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to decline proposal",
        description: "Please try again."
      });
    }
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('POST', `/api/proposals/${proposalId}/add-to-cart`);
      return await response.json();
    },
    onSuccess: (data, proposalId) => {
      const proposal = proposals.find(p => p.id === proposalId);
      toast({
        title: "Added to cart",
        description: `"${proposal?.title}" has been added to your cart.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to add to cart",
        description: "Please try again."
      });
    }
  });

  // Mark as viewed mutation
  const markAsViewedMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('PUT', `/api/proposals/${proposalId}/mark-viewed`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
    }
  });

  // Filter proposals
  const filteredProposals = proposals.filter(proposal => {
    const matchesSearch = proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proposal.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proposal.advisorName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleViewProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setIsViewDialogOpen(true);
    
    // Mark as viewed if not already viewed
    if (proposal.status === 'sent') {
      markAsViewedMutation.mutate(proposal.id);
    }
  };

  const handleAcceptProposal = (proposalId: string) => {
    acceptProposalMutation.mutate(proposalId);
  };

  const handleRejectProposal = (proposalId: string) => {
    rejectProposalMutation.mutate(proposalId);
  };

  const handleAddToCart = (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    if (proposal.status !== 'accepted') {
      toast({
        variant: "destructive",
        title: "Cannot add to cart",
        description: "Please accept the proposal first before adding to cart."
      });
      return;
    }

    addToCartMutation.mutate(proposalId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN');
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  const pendingProposals = proposals.filter(p => ['sent', 'viewed'].includes(p.status));
  const acceptedProposals = proposals.filter(p => p.status === 'accepted');
  const expiredProposals = proposals.filter(p => isExpired(p.validUntil) || p.status === 'expired');

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Investment Proposals</h1>
        <p className="text-muted-foreground">
          Review investment proposals from your financial advisor
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{pendingProposals.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold">{acceptedProposals.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(proposals.reduce((sum, p) => sum + p.totalAmount, 0))}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-proposals"
            />
          </div>
        </CardContent>
      </Card>

      {/* Proposals */}
      <div className="space-y-6">
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading proposals...</div>
              </div>
            </CardContent>
          </Card>
        ) : filteredProposals.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No proposals found</h3>
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? "No proposals match your search."
                    : "Your advisor hasn't sent you any proposals yet."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredProposals.map((proposal) => {
              const StatusIcon = statusIcons[proposal.status];
              const expired = isExpired(proposal.validUntil);
              const displayStatus = expired ? 'expired' : proposal.status;
              return (
                <Card key={proposal.id} className="hover:shadow-md transition-shadow" data-testid={`card-proposal-${proposal.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{proposal.title}</CardTitle>
                        <CardDescription className="text-sm">{proposal.description}</CardDescription>
                      </div>
                      <Badge className={statusColors[displayStatus]} variant="secondary">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Amount</span>
                        <span className="font-semibold">{formatCurrency(proposal.totalAmount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Items</span>
                        <span className="text-sm">{proposal.items.length} products</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Valid Until</span>
                        <span className={`text-sm ${expired ? 'text-red-500' : ''}`}>
                          {formatDate(proposal.validUntil)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Advisor</span>
                        <span className="text-sm">{proposal.advisorName}</span>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3">
                          {statusDescriptions[displayStatus]}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewProposal(proposal)}
                            data-testid={`button-view-${proposal.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                          {proposal.status === 'sent' && !expired && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptProposal(proposal.id)}
                                disabled={acceptProposalMutation.isPending}
                                data-testid={`button-accept-${proposal.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRejectProposal(proposal.id)}
                                disabled={rejectProposalMutation.isPending}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-reject-${proposal.id}`}
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          {proposal.status === 'accepted' && (
                            <Button
                              size="sm"
                              onClick={() => handleAddToCart(proposal.id)}
                              disabled={addToCartMutation.isPending}
                              data-testid={`button-add-cart-${proposal.id}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Add to Cart
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* View Proposal Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedProposal?.title}
            </DialogTitle>
            <DialogDescription>
              Investment proposal from {selectedProposal?.advisorName}
            </DialogDescription>
          </DialogHeader>
          {selectedProposal && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Advisor</Label>
                  <p className="text-sm">{selectedProposal.advisorName}</p>
                  <p className="text-xs text-muted-foreground">{selectedProposal.advisorEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge className={statusColors[isExpired(selectedProposal.validUntil) ? 'expired' : selectedProposal.status]} variant="secondary">
                      {(isExpired(selectedProposal.validUntil) ? 'expired' : selectedProposal.status).charAt(0).toUpperCase() + (isExpired(selectedProposal.validUntil) ? 'expired' : selectedProposal.status).slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {selectedProposal.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{selectedProposal.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Total Investment</Label>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(selectedProposal.totalAmount)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Valid Until</Label>
                  <p className="text-sm">{formatDate(selectedProposal.validUntil)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm">{formatDate(selectedProposal.createdAt)}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">Investment Breakdown ({selectedProposal.items.length} items)</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProposal.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.productName}</div>
                              {item.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{item.notes}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.productType.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {item.units && <div><strong>Units:</strong> {item.units}</div>}
                              {item.rate && <div><strong>Rate:</strong> {item.rate}% p.a.</div>}
                              {item.duration && <div><strong>Duration:</strong> {item.duration}</div>}
                              {item.frequency && <div><strong>Frequency:</strong> {item.frequency}</div>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              {selectedProposal && selectedProposal.status === 'sent' && !isExpired(selectedProposal.validUntil) && (
                <>
                  <Button
                    onClick={() => {
                      handleAcceptProposal(selectedProposal.id);
                      setIsViewDialogOpen(false);
                    }}
                    disabled={acceptProposalMutation.isPending}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Proposal
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleRejectProposal(selectedProposal.id);
                      setIsViewDialogOpen(false);
                    }}
                    disabled={rejectProposalMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    Decline
                  </Button>
                </>
              )}
              {selectedProposal && selectedProposal.status === 'accepted' && (
                <Button
                  onClick={() => {
                    handleAddToCart(selectedProposal.id);
                    setIsViewDialogOpen(false);
                  }}
                  disabled={addToCartMutation.isPending}
                  className="flex-1"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}