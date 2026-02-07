import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Briefcase, 
  ArrowRightLeft,
  Search,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ExternalHolding {
  id: string;
  clientName: string;
  clientPan: string;
  symbol: string;
  quantity: number;
  currentBroker: string;
  isin?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export default function AgentExternalPortfolios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ExternalHolding | null>(null);
  const [cobDialogOpen, setCobDialogOpen] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');
  const isAgent = user?.roles?.includes('agent') || user?.roles?.includes('partner');

  if (!isAdmin && !isAgent) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">This page is only accessible to agents and administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: externalHoldings, isLoading } = useQuery<ExternalHolding[]>({
    queryKey: ['/api/agent/external-holdings'],
    enabled: isAdmin || isAgent,
  });

  const initiateCobMutation = useMutation({
    mutationFn: async (data: { holdingId: string; targetBroker: string; reason: string }) => {
      const response = await apiRequest('/api/agent/initiate-cob', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "COB Request Initiated",
        description: "Change of Broker request has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/external-holdings'] });
      setCobDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Request Failed",
        description: "Unable to initiate COB request. Please try again.",
        variant: "destructive"
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const holdings = externalHoldings || [];
  const filteredHoldings = holdings.filter(h => 
    h.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.clientPan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" />
            External Portfolios Management
          </h1>
          <p className="text-muted-foreground">Manage client holdings from external brokers and initiate COB requests</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client External Holdings</CardTitle>
              <CardDescription>Holdings held with other brokers eligible for COB</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name, PAN, or symbol..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Current Broker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHoldings.map((holding) => (
                <TableRow key={holding.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {holding.clientName}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{holding.clientPan}</TableCell>
                  <TableCell className="font-medium">{holding.symbol}</TableCell>
                  <TableCell className="text-right">{holding.quantity}</TableCell>
                  <TableCell>{holding.currentBroker}</TableCell>
                  <TableCell>{getStatusBadge(holding.status)}</TableCell>
                  <TableCell className="text-right">
                    <Dialog open={cobDialogOpen && selectedClient?.id === holding.id} onOpenChange={(open) => {
                      setCobDialogOpen(open);
                      if (open) setSelectedClient(holding);
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={holding.status !== 'pending'}
                        >
                          <ArrowRightLeft className="w-4 h-4 mr-1" />
                          Initiate COB
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Initiate Change of Broker (COB)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Client Name</Label>
                              <p className="text-sm font-medium">{holding.clientName}</p>
                            </div>
                            <div>
                              <Label>Symbol</Label>
                              <p className="text-sm font-medium">{holding.symbol}</p>
                            </div>
                            <div>
                              <Label>Quantity</Label>
                              <p className="text-sm font-medium">{holding.quantity}</p>
                            </div>
                            <div>
                              <Label>Current Broker</Label>
                              <p className="text-sm font-medium">{holding.currentBroker}</p>
                            </div>
                          </div>
                          <div>
                            <Label>Target Broker</Label>
                            <Select defaultValue="fintekpro">
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fintekpro">FintekPro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Reason for COB</Label>
                            <Input placeholder="Enter reason..." />
                          </div>
                          <Button 
                            className="w-full"
                            onClick={() => initiateCobMutation.mutate({
                              holdingId: holding.id,
                              targetBroker: 'fintekpro',
                              reason: 'Client request'
                            })}
                          >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Submit COB Request
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredHoldings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No external holdings found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
