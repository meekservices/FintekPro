import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AgentLayout } from "@/components/layout/agent-layout";
import { AgentRecommendationControlPanel } from "@/components/agent/AgentRecommendationControlPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, ArrowRight, Target, Shield as LucideShield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Client {
  id: string;
  name: string;
  email: string;
  riskProfile: string;
  kycTier: string;
  totalAum: number;
  lastActivity: string;
}

export default function AgentRecommendationControlPage() {
  const [, navigate] = useLocation();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: clients, isLoading, isError, error } = useQuery<Client[]>({
    queryKey: ["/api/agent/clients", searchQuery],
    retry: false,
  });

  // Handle authentication errors - redirect to login
  if (isError) {
    const errorStatus = (error as any)?.status || (error as any)?.response?.status;
    const isAuthError = errorStatus === 401;
    
    if (isAuthError) {
      return (
        <AgentLayout>
          <div className="p-6 flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideShield className="w-5 h-5" />
                  Authentication Required
                </CardTitle>
                <CardDescription>
                  Please log in to access the Recommendation Control Panel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You need to be authenticated as an agent to access client recommendations.
                </p>
                <Button 
                  className="w-full" 
                  onClick={() => navigate('/login')}
                  data-testid="button-login-redirect"
                >
                  Go to Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </AgentLayout>
      );
    }

    // Show generic error for other errors
    const errorMessage = (error as any)?.message || 'An unexpected error occurred';
    return (
      <AgentLayout>
        <div className="p-6 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load clients. Please try again later.
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            data-testid="button-retry"
          >
            Retry
          </Button>
        </div>
      </AgentLayout>
    );
  }

  const filteredClients = clients?.filter(
    (client) =>
      (client.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProposalCreated = (proposalId: string) => {
    navigate(`/proposals/${proposalId}`);
  };

  if (selectedClientId) {
    return (
      <AgentLayout>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => setSelectedClientId(null)}>
              ← Back to Client Selection
            </Button>
          </div>
          <AgentRecommendationControlPanel
            clientId={selectedClientId}
            onProposalCreated={handleProposalCreated}
          />
        </div>
      </AgentLayout>
    );
  }

  return (
    <AgentLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Recommendation Control Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Select a client to generate personalized investment recommendations
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Client
            </CardTitle>
            <CardDescription>
              Choose a client to view and customize their recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="client-search-input"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Risk Profile</TableHead>
                    <TableHead>KYC Tier</TableHead>
                    <TableHead className="text-right">Total AUM</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.riskProfile}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{client.kycTier}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ₹{(client.totalAum / 100000).toFixed(2)} L
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => setSelectedClientId(client.id)}
                          data-testid={`select-client-${client.id}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No clients found. Add clients to start generating recommendations.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
}
