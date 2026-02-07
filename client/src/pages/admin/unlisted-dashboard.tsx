import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "@/components/LoadingState";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Building2,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  DollarSign,
  Users,
  Shield,
  FileText,
  ArrowRight,
  RefreshCw,
  BarChart3,
  AlertCircle,
  Info,
  Ban,
} from "lucide-react";

interface DashboardMetrics {
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  companiesNeedingPricing: number;
  companiesWithDraftPrices: number;
  highRiskCompanies: number;
  activeSellListings: number;
  activeBuyRequests: number;
  pendingDeals: number;
  completedDealsLast7Days: number;
  tradingVolumeLast7Days: number;
}

interface ComplianceAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  companyId?: string;
  companyName?: string;
  createdAt: string;
}

interface DashboardData {
  metrics: DashboardMetrics;
  complianceAlerts: ComplianceAlert[];
  recentActivity: {
    newListingsToday: number;
    newBuyRequestsToday: number;
  };
}

const formatCurrency = (value: number): string => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
};

const MetricCard = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  link,
  variant = 'default' 
}: { 
  title: string; 
  value: number | string; 
  description?: string; 
  icon: any; 
  trend?: 'up' | 'down' | 'neutral';
  link?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) => {
  const variantStyles = {
    default: 'border-border bg-muted/50',
    success: 'border-green-700 bg-green-900/20',
    warning: 'border-yellow-700 bg-yellow-900/20',
    error: 'border-red-700 bg-red-900/20',
  };
  
  const iconColors = {
    default: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };
  
  const content = (
    <Card className={`${variantStyles[variant]} hover:bg-muted/70 transition-colors cursor-pointer`} data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${iconColors[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={`text-xs mt-1 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} vs last week
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  if (link) {
    return <Link href={link}>{content}</Link>;
  }
  
  return content;
};

const AlertItem = ({ alert }: { alert: ComplianceAlert }) => {
  const icons = {
    error: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };
  
  const bgColors = {
    error: 'bg-red-900/20 border-red-800',
    warning: 'bg-yellow-900/20 border-yellow-800',
    info: 'bg-blue-900/20 border-blue-800',
  };
  
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgColors[alert.type]}`} data-testid={`alert-${alert.id}`}>
      {icons[alert.type]}
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
      </div>
      {alert.companyId && (
        <Link href={`/admin/unlisted/preview/${alert.companyId}`}>
          <Button variant="ghost" size="sm" className="text-xs" data-testid={`button-view-${alert.id}`}>
            View
          </Button>
        </Link>
      )}
    </div>
  );
};

export default function UnlistedDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  
  const { data: responseData, isLoading, error, refetch } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ['/api/unlisted/admin/dashboard-metrics'],
    refetchInterval: 60000,
  });
  
  if (authLoading) {
    return <LoadingState />;
  }
  
  if (!user || !user.roles?.includes('admin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="bg-card border-border max-w-md">
          <CardHeader>
            <CardTitle className="text-foreground text-center">Access Denied</CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              Admin privileges required to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  if (isLoading) {
    return <LoadingState />;
  }
  
  const data = responseData?.data;
  
  if (error || !data) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load dashboard metrics</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const { metrics, complianceAlerts, recentActivity } = data;
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Unlisted Marketplace Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of marketplace activity and compliance status</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-border"
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Companies"
          value={metrics.totalCompanies}
          description={`${metrics.activeCompanies} active`}
          icon={Building2}
          link="/admin/unlisted/companies"
        />
        <MetricCard
          title="Active Sell Listings"
          value={metrics.activeSellListings}
          description={`+${recentActivity.newListingsToday} today`}
          icon={Package}
          link="/admin/unlisted/orders"
          variant="success"
        />
        <MetricCard
          title="Active Buy Requests"
          value={metrics.activeBuyRequests}
          description={`+${recentActivity.newBuyRequestsToday} today`}
          icon={ShoppingCart}
          link="/admin/unlisted/orders"
          variant="success"
        />
        <MetricCard
          title="Trading Volume (7d)"
          value={formatCurrency(metrics.tradingVolumeLast7Days)}
          description={`${metrics.completedDealsLast7Days} deals completed`}
          icon={TrendingUp}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Deals"
          value={metrics.pendingDeals}
          description="Awaiting settlement"
          icon={Clock}
          variant={metrics.pendingDeals > 10 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Needs Pricing"
          value={metrics.companiesNeedingPricing}
          description="Companies without prices"
          icon={DollarSign}
          link="/admin/unlisted/companies"
          variant={metrics.companiesNeedingPricing > 5 ? 'warning' : 'default'}
        />
        <MetricCard
          title="Draft Prices"
          value={metrics.companiesWithDraftPrices}
          description="Pending review/publish"
          icon={FileText}
          link="/admin/unlisted/companies"
        />
        <MetricCard
          title="High Risk"
          value={metrics.highRiskCompanies}
          description="Blocked or flagged"
          icon={Shield}
          variant={metrics.highRiskCompanies > 0 ? 'error' : 'default'}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Compliance Alerts</CardTitle>
                <CardDescription>Issues requiring attention</CardDescription>
              </div>
              <Badge variant={complianceAlerts.length > 0 ? "destructive" : "secondary"}>
                {complianceAlerts.length} alerts
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {complianceAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-foreground font-medium">All Clear</p>
                <p className="text-muted-foreground text-sm">No compliance issues detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {complianceAlerts.map(alert => (
                  <AlertItem key={alert.id} alert={alert} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/unlisted/companies">
              <Button variant="outline" className="w-full justify-between border-border" data-testid="button-manage-companies">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Manage Companies
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/unlisted/orders">
              <Button variant="outline" className="w-full justify-between border-border" data-testid="button-manage-orders">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Order Management
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/unlisted/negotiations">
              <Button variant="outline" className="w-full justify-between border-border" data-testid="button-negotiations">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Negotiations
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/unlisted/audit-log">
              <Button variant="outline" className="w-full justify-between border-border" data-testid="button-audit-log">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Audit Log
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Separator className="my-2 bg-muted" />
            <Link href="/admin/unlisted/seed">
              <Button variant="outline" className="w-full justify-between border-border text-green-400 hover:text-green-300" data-testid="button-seed-data">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Seed Test Data
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Trading Status</CardTitle>
          <CardDescription>Current marketplace state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-green-900/50">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{metrics.activeCompanies}</p>
                <p className="text-xs text-muted-foreground">Active Trading</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-yellow-900/50">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{metrics.companiesWithDraftPrices}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-orange-900/50">
                <Ban className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{metrics.suspendedCompanies}</p>
                <p className="text-xs text-muted-foreground">Suspended</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="p-2 rounded-full bg-red-900/50">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{metrics.highRiskCompanies}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
