import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Loader2, IndianRupee, Users, TrendingUp, Wallet, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsSummary {
  totalEarnings: string;
  monthlyEarnings: string;
  pendingEarnings: string;
  paidEarnings: string;
  commissionBreakdown: {
    trail: string;
    upfront: string;
  };
}

interface ClientsSummary {
  totalClients: number;
  activeClients: number;
  totalAUM: string;
  avgPortfolioValue: string;
}

interface Commission {
  id: string;
  clientName: string;
  schemeName: string;
  commissionType: 'trail' | 'upfront';
  commissionAmount: string;
  netCommission: string;
  payoutStatus: string;
  rtaReportDate: string;
}

export default function AgentDashboard() {
  const { user } = useAuth();

  const { data: agentData, isLoading: loadingAgent } = useQuery<any>({
    queryKey: ['/api/agents/my-agent'],
  });

  const agentId = agentData?.id;

  const { data: earnings, isLoading: loadingEarnings } = useQuery<EarningsSummary>({
    queryKey: ['/api/agents', agentId, 'earnings-summary'],
    enabled: !!agentId
  });

  const { data: clientsSummary, isLoading: loadingClients } = useQuery<ClientsSummary>({
    queryKey: ['/api/agents', agentId, 'clients-summary'],
    enabled: !!agentId
  });

  const { data: recentCommissions, isLoading: loadingCommissions } = useQuery<{ commissions: Commission[] }>({
    queryKey: ['/api/agents', agentId, 'commissions'],
    enabled: !!agentId
  });

  if (loadingAgent || !agentId) {
    return (
      <AgentLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AgentLayout>
    );
  }

  const monthlyData = [
    { month: 'Jan', earnings: 45000 },
    { month: 'Feb', earnings: 52000 },
    { month: 'Mar', earnings: 48000 },
    { month: 'Apr', earnings: 61000 },
    { month: 'May', earnings: 58000 },
    { month: 'Jun', earnings: 65000 }
  ];

  return (
    <AgentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-agent-dashboard">
            Agent Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {agentData.businessName || agentData.contactPersonName}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-earnings">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-earnings">
                    ₹{parseFloat(earnings?.totalEarnings || '0').toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ₹{parseFloat(earnings?.monthlyEarnings || '0').toLocaleString('en-IN')} this month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-total-clients">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-clients">
                    {clientsSummary?.totalClients || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {clientsSummary?.activeClients || 0} active
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-total-aum">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-aum">
                    ₹{parseFloat(clientsSummary?.totalAUM || '0').toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Avg ₹{parseFloat(clientsSummary?.avgPortfolioValue || '0').toLocaleString('en-IN')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-pending-payouts">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingEarnings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-pending-payouts">
                    ₹{parseFloat(earnings?.pendingEarnings || '0').toLocaleString('en-IN')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ₹{parseFloat(earnings?.paidEarnings || '0').toLocaleString('en-IN')} paid
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card data-testid="card-earnings-chart">
            <CardHeader>
              <CardTitle>Monthly Earnings Trend</CardTitle>
              <CardDescription>Last 6 months commission earnings</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="earnings" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-commission-breakdown">
            <CardHeader>
              <CardTitle>Commission Breakdown</CardTitle>
              <CardDescription>Trail vs Upfront commissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingEarnings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Trail Commission</p>
                      <p className="text-xs text-muted-foreground">Recurring monthly income</p>
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-trail-commission">
                      ₹{parseFloat(earnings?.commissionBreakdown?.trail || '0').toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Upfront Commission</p>
                      <p className="text-xs text-muted-foreground">One-time earnings</p>
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-upfront-commission">
                      ₹{parseFloat(earnings?.commissionBreakdown?.upfront || '0').toLocaleString('en-IN')}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-recent-commissions">
          <CardHeader>
            <CardTitle>Recent Commissions</CardTitle>
            <CardDescription>Latest commission entries from RTA reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCommissions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCommissions?.commissions?.slice(0, 10).map((comm) => (
                    <TableRow key={comm.id} data-testid={`row-commission-${comm.id}`}>
                      <TableCell className="font-medium">{comm.clientName || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{comm.schemeName}</TableCell>
                      <TableCell>
                        <Badge variant={comm.commissionType === 'trail' ? 'default' : 'secondary'}>
                          {comm.commissionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{parseFloat(comm.netCommission).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={comm.payoutStatus === 'paid' ? 'default' : 'outline'}
                          data-testid={`status-${comm.payoutStatus}`}
                        >
                          {comm.payoutStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(comm.rtaReportDate), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!recentCommissions?.commissions || recentCommissions.commissions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No commission data available yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AgentLayout>
  );
}
