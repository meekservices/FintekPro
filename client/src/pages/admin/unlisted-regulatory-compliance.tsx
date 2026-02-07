import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  Users, 
  Lock, 
  AlertTriangle, 
  Building2,
  Clock,
  FileWarning,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  RefreshCw,
  Eye,
  Ban,
  ArrowRight,
  Scale,
  Landmark,
  FileText
} from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { format, formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ComplianceOverview {
  investorLimits: {
    companiesNearLimit: number;
    companiesAtLimit: number;
  };
  lockIns: {
    activeRecords: number;
    sharesLocked: number;
    unlockingThisMonth: number;
  };
  strFlags: {
    pending: number;
    overdue: number;
    filedThisMonth: number;
  };
  statusChanges: {
    listedThisMonth: number;
    suspended: number;
  };
}

interface STRFlag {
  id: string;
  dealId?: string;
  userId: string;
  companyId: string;
  flagType: string;
  severity: string;
  transactionAmount: string;
  flagReason: string;
  detectionMethod: string;
  strDueDate: string;
  status: string;
  createdAt: string;
}

interface InvestorCount {
  financialYear: string;
  currentCount: number;
  maxAllowed: number;
  utilizationPercent: number;
  isNearLimit: boolean;
}

export default function UnlistedRegulatoryCompliance() {
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const { data: overviewData, isLoading: isLoadingOverview, refetch: refetchOverview } = useQuery<{ success: boolean; data: ComplianceOverview }>({
    queryKey: ['/api/unlisted/admin/compliance/overview'],
    retry: false,
  });

  const { data: strFlagsData, isLoading: isLoadingFlags, refetch: refetchFlags } = useQuery<{ success: boolean; data: { total: number; overdue: number; dueSoon: number; flags: STRFlag[] } }>({
    queryKey: ['/api/unlisted/admin/compliance/str-flags'],
    retry: false,
  });

  const overview = overviewData?.data;
  const strData = strFlagsData?.data;

  const handleRefresh = () => {
    refetchOverview();
    refetchFlags();
    toast({
      title: 'Refreshing data',
      description: 'Fetching latest compliance data...',
    });
  };

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

  const getFlagTypeBadge = (type: string) => {
    switch (type) {
      case 'source_of_funds':
        return <Badge className="bg-red-700"><FileWarning className="w-3 h-3 mr-1" />Source of Funds</Badge>;
      case 'high_frequency':
        return <Badge className="bg-orange-700"><TrendingUp className="w-3 h-3 mr-1" />High Frequency</Badge>;
      case 'structured_payment':
        return <Badge className="bg-purple-700"><Scale className="w-3 h-3 mr-1" />Structured Payment</Badge>;
      case 'round_tripping':
        return <Badge className="bg-pink-700"><RefreshCw className="w-3 h-3 mr-1" />Round Tripping</Badge>;
      case 'pep_involvement':
        return <Badge className="bg-red-800"><Landmark className="w-3 h-3 mr-1" />PEP Involvement</Badge>;
      default:
        return <Badge variant="outline">{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pending Review</Badge>;
      case 'under_review':
        return <Badge className="bg-blue-600">Under Review</Badge>;
      case 'filed':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Filed</Badge>;
      case 'dismissed':
        return <Badge variant="secondary">Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoadingOverview) {
    return <LoadingState message="Loading regulatory compliance data..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="regulatory-compliance-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-500" />
            Regulatory Compliance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            SEBI, RBI & Companies Act compliance monitoring for unlisted share trading
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700" data-testid="card-investor-limits">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-300 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  200 Investor Limit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{overview.investorLimits.companiesAtLimit}</div>
                <p className="text-xs text-blue-300 mt-1">Companies at limit</p>
                {overview.investorLimits.companiesNearLimit > 0 && (
                  <Alert className="mt-2 bg-yellow-900/30 border-yellow-700">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-yellow-300 text-xs">
                      {overview.investorLimits.companiesNearLimit} companies near limit (90%+)
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700" data-testid="card-lock-ins">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  6-Month Lock-In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{overview.lockIns.activeRecords.toLocaleString()}</div>
                <p className="text-xs text-purple-300 mt-1">Active lock-in records</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="border-purple-500 text-purple-300">
                    {overview.lockIns.sharesLocked.toLocaleString()} shares locked
                  </Badge>
                </div>
                {overview.lockIns.unlockingThisMonth > 0 && (
                  <p className="text-xs text-green-400 mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {overview.lockIns.unlockingThisMonth} unlocking this month
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${overview.strFlags.overdue > 0 ? 'from-red-900/50 to-red-800/30 border-red-700' : 'from-orange-900/50 to-orange-800/30 border-orange-700'}`} data-testid="card-str-flags">
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium flex items-center gap-2 ${overview.strFlags.overdue > 0 ? 'text-red-300' : 'text-orange-300'}`}>
                  <FileWarning className="h-4 w-4" />
                  STR Flags (FIU-IND)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{overview.strFlags.pending}</div>
                <p className={`text-xs mt-1 ${overview.strFlags.overdue > 0 ? 'text-red-300' : 'text-orange-300'}`}>Pending review</p>
                {overview.strFlags.overdue > 0 && (
                  <Alert className="mt-2 bg-red-900/50 border-red-600">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-red-300 text-xs">
                      {overview.strFlags.overdue} overdue - immediate action required!
                    </AlertDescription>
                  </Alert>
                )}
                {overview.strFlags.filedThisMonth > 0 && (
                  <p className="text-xs text-green-400 mt-2">
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    {overview.strFlags.filedThisMonth} filed this month
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border-emerald-700" data-testid="card-status-changes">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{overview.statusChanges.suspended}</div>
                <p className="text-xs text-emerald-300 mt-1">Trading suspended</p>
                {overview.statusChanges.listedThisMonth > 0 && (
                  <Badge className="mt-2 bg-green-700">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {overview.statusChanges.listedThisMonth} listed this month
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-blue-900/20 border-blue-700">
            <Shield className="h-4 w-4 text-blue-500" />
            <AlertTitle className="text-blue-300">Regulatory Framework</AlertTitle>
            <AlertDescription className="text-blue-200 text-sm">
              Monitoring compliance with Companies Act Section 42 (200 investor limit), 
              SEBI private placement lock-in requirements (6 months), and PMLA STR reporting (7 working days).
            </AlertDescription>
          </Alert>
        </>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Eye className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="str-flags" data-testid="tab-str-flags">
            <FileWarning className="w-4 h-4 mr-2" />
            STR Flags {strData && strData.pending > 0 && <Badge className="ml-2 bg-red-600">{strData.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="investor-limits" data-testid="tab-investor-limits">
            <Users className="w-4 h-4 mr-2" />
            Investor Limits
          </TabsTrigger>
          <TabsTrigger value="lock-ins" data-testid="tab-lock-ins">
            <Lock className="w-4 h-4 mr-2" />
            Lock-Ins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-compliance-checklist">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Compliance Checklist
                </CardTitle>
                <CardDescription>Key regulatory requirements status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="font-medium">200 Investor Limit Monitoring</p>
                      <p className="text-xs text-muted-foreground">Companies Act Section 42(2)</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="font-medium">6-Month Lock-In Enforcement</p>
                      <p className="text-xs text-muted-foreground">SEBI Private Placement Rules</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileWarning className="h-5 w-5 text-orange-400" />
                    <div>
                      <p className="font-medium">STR Red Flag Detection</p>
                      <p className="text-xs text-muted-foreground">PMLA / FIU-IND Compliance</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="font-medium">MCA Status Monitoring</p>
                      <p className="text-xs text-muted-foreground">Auto-suspend on listing</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-yellow-400" />
                    <div>
                      <p className="font-medium">Source of Funds Verification</p>
                      <p className="text-xs text-muted-foreground">Trades ≥₹50 Lakhs</p>
                    </div>
                  </div>
                  <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-blue-500" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common compliance tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('str-flags')} data-testid="button-review-str">
                  <FileWarning className="h-4 w-4 mr-2 text-orange-400" />
                  Review Pending STR Flags
                  {overview && overview.strFlags.pending > 0 && (
                    <Badge className="ml-auto bg-orange-600">{overview.strFlags.pending}</Badge>
                  )}
                </Button>
                
                <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('investor-limits')} data-testid="button-check-limits">
                  <Users className="h-4 w-4 mr-2 text-blue-400" />
                  Check Investor Limits
                  {overview && overview.investorLimits.companiesNearLimit > 0 && (
                    <Badge className="ml-auto bg-yellow-600">{overview.investorLimits.companiesNearLimit}</Badge>
                  )}
                </Button>
                
                <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('lock-ins')} data-testid="button-view-lockings">
                  <Lock className="h-4 w-4 mr-2 text-purple-400" />
                  View Upcoming Unlocks
                  {overview && overview.lockIns.unlockingThisMonth > 0 && (
                    <Badge className="ml-auto bg-green-600">{overview.lockIns.unlockingThisMonth}</Badge>
                  )}
                </Button>

                <Separator />
                
                <Button variant="outline" className="w-full justify-start text-muted-foreground" data-testid="button-export-report">
                  <FileText className="h-4 w-4 mr-2" />
                  Export Compliance Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="str-flags" className="mt-6">
          <Card data-testid="card-str-flags-table">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-orange-500" />
                Suspicious Transaction Report Flags
              </CardTitle>
              <CardDescription>
                Flagged transactions requiring review for FIU-IND reporting (7 working day deadline)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFlags ? (
                <LoadingState message="Loading STR flags..." />
              ) : strData && strData.flags.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flag Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strData.flags.map((flag) => (
                      <TableRow key={flag.id} data-testid={`row-str-flag-${flag.id}`}>
                        <TableCell>{getFlagTypeBadge(flag.flagType)}</TableCell>
                        <TableCell>{getSeverityBadge(flag.severity)}</TableCell>
                        <TableCell className="font-mono">
                          ₹{parseFloat(flag.transactionAmount || '0').toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {flag.flagReason}
                        </TableCell>
                        <TableCell>
                          {flag.strDueDate && (
                            <div className={`text-sm ${new Date(flag.strDueDate) < new Date() ? 'text-red-400 font-medium' : 'text-muted-foreground'}`}>
                              {format(new Date(flag.strDueDate), 'dd MMM yyyy')}
                              <br />
                              <span className="text-xs">
                                {formatDistanceToNow(new Date(flag.strDueDate), { addSuffix: true })}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(flag.status)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" data-testid={`button-review-${flag.id}`}>
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState
                  icon={CheckCircle}
                  title="No Pending STR Flags"
                  description="All suspicious transaction reports have been reviewed and filed."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investor-limits" className="mt-6">
          <Card data-testid="card-investor-limits-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                200 Investor Limit Tracking
              </CardTitle>
              <CardDescription>
                Companies Act Section 42(2) - Private placement cannot exceed 200 investors per company per financial year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-blue-900/20 border-blue-700">
                <Shield className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-300">Compliance Note</AlertTitle>
                <AlertDescription className="text-blue-200 text-sm">
                  If a company exceeds 200 investors in a financial year, it triggers public issue requirements 
                  under SEBI regulations. The platform automatically blocks new investors when the limit is reached.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{overview?.investorLimits.companiesAtLimit || 0}</div>
                    <p className="text-sm text-red-400">At Limit (200)</p>
                    <p className="text-xs text-muted-foreground mt-1">New investors blocked</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{overview?.investorLimits.companiesNearLimit || 0}</div>
                    <p className="text-sm text-yellow-400">Near Limit (180-199)</p>
                    <p className="text-xs text-muted-foreground mt-1">Requires monitoring</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">200</div>
                    <p className="text-sm text-green-400">Max Investors/FY</p>
                    <p className="text-xs text-muted-foreground mt-1">Per company limit</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lock-ins" className="mt-6">
          <Card data-testid="card-lock-ins-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-500" />
                6-Month Lock-In Period Tracking
              </CardTitle>
              <CardDescription>
                SEBI private placement regulations - Securities cannot be sold within 6 months of acquisition
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 bg-purple-900/20 border-purple-700">
                <Lock className="h-4 w-4 text-purple-500" />
                <AlertTitle className="text-purple-300">Lock-In Rules</AlertTitle>
                <AlertDescription className="text-purple-200 text-sm">
                  Shares acquired through private placement have a mandatory 6-month lock-in period. 
                  The platform automatically blocks sell orders for locked shares and calculates unlock dates.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{overview?.lockIns.activeRecords?.toLocaleString() || 0}</div>
                    <p className="text-sm text-purple-400">Active Lock-Ins</p>
                    <p className="text-xs text-muted-foreground mt-1">Currently enforced</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{overview?.lockIns.sharesLocked?.toLocaleString() || 0}</div>
                    <p className="text-sm text-blue-400">Shares Locked</p>
                    <p className="text-xs text-muted-foreground mt-1">Cannot be sold yet</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{overview?.lockIns.unlockingThisMonth || 0}</div>
                    <p className="text-sm text-green-400">Unlocking This Month</p>
                    <p className="text-xs text-muted-foreground mt-1">Will become tradeable</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
