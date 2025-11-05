import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Users, TrendingUp, IndianRupee, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClientMapping {
  id: string;
  clientId: string;
  productType: string;
  assignmentType: string;
  isActive: boolean;
  createdAt: string;
  portfolioValue?: string;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    panNumber: string;
  };
}

interface ClientPortfolio {
  clientId: string;
  totalInvestment: string;
  currentValue: string;
  unrealizedGains: string;
  xirr: string;
  holdings: Array<{
    schemeName: string;
    units: number;
    currentValue: string;
    unrealizedGain: string;
  }>;
}

export default function AgentClients() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const { data: agentData } = useQuery<any>({
    queryKey: ['/api/agents/my-agent'],
  });

  const agentId = agentData?.id;

  const { data: clientMappings, isLoading } = useQuery<ClientMapping[]>({
    queryKey: ['/api/agents', agentId, 'client-mappings'],
    enabled: !!agentId
  });

  const { data: clientPortfolio, isLoading: loadingPortfolio } = useQuery<ClientPortfolio>({
    queryKey: ['/api/clients', selectedClient, 'portfolio'],
    enabled: !!selectedClient
  });

  const filteredClients = clientMappings?.filter(mapping => {
    const client = mapping.client;
    const matchesSearch = !searchQuery || 
      client?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client?.mobile?.includes(searchQuery) ||
      client?.panNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesProduct = productFilter === "all" || mapping.productType === productFilter;
    
    return matchesSearch && matchesProduct && mapping.isActive;
  });

  const totalAUM = filteredClients?.reduce((sum, mapping) => {
    const portfolioValue = parseFloat(mapping.portfolioValue || "0");
    return sum + portfolioValue;
  }, 0) || 0;

  return (
    <AgentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-my-clients">
            My Clients
          </h1>
          <p className="text-muted-foreground">
            Manage your client portfolios and track their investments
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-clients">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-count">
                {filteredClients?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active relationships
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-client-aum">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-aum">
                ₹{totalAUM.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-muted-foreground">
                Assets under management
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-portfolio">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Portfolio</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-portfolio">
                ₹{filteredClients && filteredClients.length > 0 
                  ? (totalAUM / filteredClients.length).toLocaleString('en-IN')
                  : '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per client value
              </p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-client-list">
          <CardHeader>
            <CardTitle>Client Portfolio</CardTitle>
            <CardDescription>Search and view your clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, mobile, or PAN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-clients"
                />
              </div>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-product-filter">
                  <SelectValue placeholder="Filter by product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="mutual_funds">Mutual Funds</SelectItem>
                  <SelectItem value="bonds">Bonds</SelectItem>
                  <SelectItem value="stocks">Stocks</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Product Type</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((mapping) => (
                    <TableRow key={mapping.id} data-testid={`row-client-${mapping.clientId}`}>
                      <TableCell className="font-medium">
                        {mapping.client?.firstName} {mapping.client?.lastName}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{mapping.client?.email}</div>
                          <div className="text-sm text-muted-foreground">{mapping.client?.mobile}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {mapping.client?.panNumber}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {mapping.productType.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapping.assignmentType === 'referral' ? 'default' : 'secondary'}>
                          {mapping.assignmentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedClient(mapping.clientId)}
                          data-testid={`button-view-${mapping.clientId}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Portfolio
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredClients || filteredClients.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchQuery || productFilter !== "all" 
                          ? "No clients match your search criteria"
                          : "No clients assigned yet"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Client Portfolio Details</DialogTitle>
            <DialogDescription>
              View detailed portfolio information
            </DialogDescription>
          </DialogHeader>
          {loadingPortfolio ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : clientPortfolio ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Investment</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-lg font-bold">
                      ₹{parseFloat(clientPortfolio.totalInvestment).toLocaleString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Current Value</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-lg font-bold">
                      ₹{parseFloat(clientPortfolio.currentValue).toLocaleString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Gains</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-lg font-bold text-green-600">
                      ₹{parseFloat(clientPortfolio.unrealizedGains).toLocaleString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">XIRR</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-lg font-bold">
                      {parseFloat(clientPortfolio.xirr).toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Holdings</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheme</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                      <TableHead className="text-right">Gains</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientPortfolio.holdings?.map((holding, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{holding.schemeName}</TableCell>
                        <TableCell className="text-right">{holding.units.toFixed(3)}</TableCell>
                        <TableCell className="text-right">
                          ₹{parseFloat(holding.currentValue).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ₹{parseFloat(holding.unrealizedGain).toLocaleString('en-IN')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No portfolio data available
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AgentLayout>
  );
}
