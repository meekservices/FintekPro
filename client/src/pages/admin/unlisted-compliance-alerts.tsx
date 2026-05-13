import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  Shield as LucideShield, 
  XCircle, 
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Building2,
  User,
  TrendingDown,
  FileWarning,
  Eye,
  CheckCircle
} from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { format } from 'date-fns';

interface ComplianceAlert {
  id: string;
  type: 'blocked_trade' | 'kyc_failure' | 'high_risk' | 'eligibility_block' | 'disclosure_missing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  companyId?: string;
  companyName?: string;
  userId?: string;
  userName?: string;
  tradeValue?: number;
  reason?: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

interface ComplianceStats {
  totalAlerts: number;
  criticalAlerts: number;
  blockedTrades: number;
  kycFailures: number;
  highRiskCompanies: number;
  pendingAcknowledgment: number;
}

export default function UnlistedComplianceAlerts() {
  const [activeTab, setActiveTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: statsData, isLoading: isLoadingStats } = useQuery<{ success: boolean; data: ComplianceStats }>({
    queryKey: ['/api/unlisted/admin/compliance/stats', refreshKey],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/compliance/stats', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch compliance stats');
      return response.json();
    },
    retry: false,
  });

  const { data: alertsData, isLoading: isLoadingAlerts, refetch } = useQuery<{ success: boolean; data: ComplianceAlert[] }>({
    queryKey: ['/api/unlisted/admin/compliance/alerts', activeTab, severityFilter, refreshKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('type', activeTab);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const url = `/api/unlisted/admin/compliance/alerts${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch compliance alerts');
      return response.json();
    },
    retry: false,
  });

  const stats = statsData?.data || {
    totalAlerts: 0,
    criticalAlerts: 0,
    blockedTrades: 0,
    kycFailures: 0,
    highRiskCompanies: 0,
    pendingAcknowledgment: 0
  };

  const alerts = alertsData?.data || [];

  const filteredAlerts = alerts.filter(alert => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.title.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        alert.companyName?.toLowerCase().includes(query) ||
        alert.userName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-600 text-white">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-600 text-white">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-600 text-white">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-600 text-white">Low</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'blocked_trade':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Blocked Trade</Badge>;
      case 'kyc_failure':
        return <Badge className="bg-amber-600"><LucideShield className="w-3 h-3 mr-1" />KYC Failure</Badge>;
      case 'high_risk':
        return <Badge className="bg-purple-600"><TrendingDown className="w-3 h-3 mr-1" />High Risk</Badge>;
      case 'eligibility_block':
        return <Badge className="bg-orange-600"><AlertCircle className="w-3 h-3 mr-1" />Eligibility Block</Badge>;
      case 'disclosure_missing':
        return <Badge className="bg-muted"><FileWarning className="w-3 h-3 mr-1" />Disclosure Missing</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="destructive">Active</Badge>;
      case 'acknowledged':
        return <Badge className="bg-yellow-600">Acknowledged</Badge>;
      case 'resolved':
        return <Badge className="bg-green-600">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (isLoadingStats || isLoadingAlerts) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compliance Alert Center</h1>
          <p className="text-muted-foreground mt-1">Monitor blocked trades, KYC failures, and high-risk activities</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          className="border-border"
          data-testid="button-refresh-alerts"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card className="bg-card border-border" data-testid="card-total-alerts">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Total Alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="text-2xl font-bold text-foreground">{stats.totalAlerts}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-950 border-red-800" data-testid="card-critical-alerts">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-400">Critical</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-400">{stats.criticalAlerts}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-blocked-trades">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">Blocked Trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-orange-500" />
              <span className="text-2xl font-bold text-foreground">{stats.blockedTrades}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-kyc-failures">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">KYC Failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <LucideShield className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold text-foreground">{stats.kycFailures}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="card-high-risk">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">High Risk Companies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold text-foreground">{stats.highRiskCompanies}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-950 border-amber-800" data-testid="card-pending-ack">
          <CardHeader className="pb-2">
            <CardDescription className="text-amber-400">Pending Acknowledgment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold text-amber-400">{stats.pendingAcknowledgment}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-foreground">Compliance Alerts</CardTitle>
              <CardDescription className="text-muted-foreground">
                Real-time monitoring of compliance events
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search alerts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted border-border text-foreground w-64"
                  data-testid="input-search-alerts"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted border-border">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-600">
                All Alerts
              </TabsTrigger>
              <TabsTrigger value="blocked_trade" className="data-[state=active]:bg-blue-600">
                <XCircle className="w-4 h-4 mr-1" />
                Blocked Trades
              </TabsTrigger>
              <TabsTrigger value="kyc_failure" className="data-[state=active]:bg-blue-600">
                <LucideShield className="w-4 h-4 mr-1" />
                KYC Failures
              </TabsTrigger>
              <TabsTrigger value="high_risk" className="data-[state=active]:bg-blue-600">
                <TrendingDown className="w-4 h-4 mr-1" />
                High Risk
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {filteredAlerts.length === 0 ? (
                <EmptyState
                  icon={CheckCircle}
                  title="No Compliance Alerts"
                  description="All systems are operating normally. No compliance issues detected."
                />
              ) : (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-muted/50">
                        <TableHead className="text-muted-foreground">Timestamp</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground">Severity</TableHead>
                        <TableHead className="text-muted-foreground">Details</TableHead>
                        <TableHead className="text-muted-foreground">Company</TableHead>
                        <TableHead className="text-muted-foreground">User</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.map((alert) => (
                        <TableRow
                          key={alert.id}
                          className={`border-border hover:bg-muted/50 ${
                            alert.severity === 'critical' ? 'bg-red-950/30' : ''
                          }`}
                          data-testid={`row-alert-${alert.id}`}
                        >
                          <TableCell className="text-muted-foreground text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {format(new Date(alert.timestamp), 'MMM dd, HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(alert.type)}</TableCell>
                          <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="text-foreground font-medium truncate">{alert.title}</div>
                            <div className="text-muted-foreground text-sm truncate">{alert.description}</div>
                          </TableCell>
                          <TableCell>
                            {alert.companyName ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-400" />
                                <span className="text-foreground text-sm">{alert.companyName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {alert.userName ? (
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-green-400" />
                                <span className="text-foreground text-sm">{alert.userName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(alert.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              data-testid={`button-view-alert-${alert.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
