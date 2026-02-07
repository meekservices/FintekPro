import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import { useQuery } from '@tanstack/react-query';
import { 
  Package,
  ShoppingCart, 
  ArrowLeft, 
  Bot,
  Users,
  User,
  Filter,
  CheckCircle,
  Clock,
  TrendingUp,
  Building2,
  Coins,
  FileText,
  Landmark,
  Calendar,
  CircleDot,
  Circle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { UnifiedCartItem, ProductCategory, CartItemStatus } from "@shared/schema";

interface OrderFilters {
  category: 'all' | ProductCategory;
  status: 'all' | CartItemStatus;
  source: 'all' | 'client' | 'agent' | 'ai';
}

const categoryLabels: Record<ProductCategory | 'all', string> = {
  all: 'All Categories',
  store: 'Store Products',
  unlisted: 'Unlisted Shares',
  mutual_fund: 'Mutual Funds',
  bond: 'Bonds',
  ncd: 'NCDs',
  ipo: 'IPOs'
};

const statusLabels: Record<CartItemStatus | 'all', string> = {
  all: 'All Statuses',
  active: 'Active',
  pending_approval: 'Pending Approval',
  removed: 'Removed'
};

const getCategoryIcon = (cat: ProductCategory | 'all') => {
  switch (cat) {
    case 'mutual_fund': return <Coins className="w-5 h-5" />;
    case 'bond': return <FileText className="w-5 h-5" />;
    case 'ncd': return <Landmark className="w-5 h-5" />;
    case 'ipo': return <TrendingUp className="w-5 h-5" />;
    case 'unlisted': return <Building2 className="w-5 h-5" />;
    case 'store': return <Package className="w-5 h-5" />;
    default: return <ShoppingCart className="w-5 h-5" />;
  }
};

const getCategoryColor = (cat: ProductCategory) => {
  switch (cat) {
    case 'mutual_fund': return 'border-l-blue-500';
    case 'bond': return 'border-l-green-500';
    case 'ncd': return 'border-l-purple-500';
    case 'ipo': return 'border-l-orange-500';
    case 'unlisted': return 'border-l-amber-500';
    case 'store': return 'border-l-gray-500';
    default: return 'border-l-primary';
  }
};

const getStatusColor = (status: CartItemStatus) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700 border-green-200';
    case 'pending_approval': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'removed': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

function StatusTimeline({ status, approvedAt, createdAt, source }: { 
  status: string | null; 
  approvedAt?: Date | string | null; 
  createdAt?: Date | string | null;
  source?: string;
}) {
  const normalizedStatus = status || 'active';
  const needsApproval = source === 'ai' || source === 'agent';
  
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return null;
    if (date instanceof Date) return date.toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };
  
  const steps = needsApproval 
    ? [
        { key: 'created', label: 'Created', icon: Circle, date: createdAt },
        { key: 'pending', label: 'Pending Review', icon: Clock },
        { key: 'approved', label: 'Approved', icon: CheckCircle, date: approvedAt },
        { key: 'active', label: 'Active', icon: Package }
      ]
    : [
        { key: 'created', label: 'Created', icon: Circle, date: createdAt },
        { key: 'active', label: 'Active', icon: CheckCircle },
        { key: 'processing', label: 'Processing', icon: Clock },
        { key: 'completed', label: 'Completed', icon: Package }
      ];
  
  const getStepStatus = (stepKey: string) => {
    if (normalizedStatus === 'removed') {
      return stepKey === 'created' ? 'completed' : 'cancelled';
    }
    
    if (needsApproval) {
      if (stepKey === 'created') return 'completed';
      if (stepKey === 'pending') {
        if (normalizedStatus === 'pending_approval') return 'current';
        return 'completed';
      }
      if (stepKey === 'approved') {
        if (normalizedStatus === 'pending_approval') return 'upcoming';
        if (normalizedStatus === 'active') return 'completed';
        return 'upcoming';
      }
      if (stepKey === 'active') {
        if (normalizedStatus === 'active') return 'current';
        return 'upcoming';
      }
    } else {
      if (stepKey === 'created') return 'completed';
      if (stepKey === 'active') {
        if (normalizedStatus === 'active') return 'current';
        return 'completed';
      }
      if (stepKey === 'processing') {
        return 'upcoming';
      }
      if (stepKey === 'completed') {
        return 'upcoming';
      }
    }
    return 'upcoming';
  };

  return (
    <div className="flex items-center gap-2 mt-4" data-testid="status-timeline">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        const Icon = step.icon;
        
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`rounded-full p-1 ${
                stepStatus === 'completed' ? 'bg-green-500 text-white' :
                stepStatus === 'current' ? 'bg-blue-500 text-white' :
                stepStatus === 'cancelled' ? 'bg-red-200 text-red-500' :
                'bg-muted text-muted-foreground'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-xs mt-1 ${
                stepStatus === 'completed' ? 'text-green-600' :
                stepStatus === 'current' ? 'text-blue-600 font-medium' :
                'text-muted-foreground'
              }`}>
                {step.label}
              </span>
              {step.date && formatDate(step.date) && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(step.date)}
                </span>
              )}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${
                stepStatus === 'completed' ? 'bg-green-500' :
                stepStatus === 'cancelled' ? 'bg-red-200' :
                'bg-muted'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ item }: { item: UnifiedCartItem }) {
  return (
    <div 
      className={`p-4 border rounded-lg hover:shadow-md transition-shadow border-l-4 ${getCategoryColor(item.productCategory as ProductCategory)}`}
      data-testid={`order-card-${item.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {getCategoryIcon(item.productCategory as ProductCategory)}
            <h3 className="font-semibold text-lg" data-testid={`text-order-name-${item.id}`}>
              {item.displayName || 'Order Item'}
            </h3>
            <Badge 
              className={`text-xs ${
                item.source === 'ai' ? 'bg-purple-100 text-purple-700' :
                item.source === 'agent' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}
              data-testid={`badge-source-${item.id}`}
            >
              {item.source === 'ai' && <Bot className="w-3 h-3 mr-1" />}
              {item.source === 'agent' && <Users className="w-3 h-3 mr-1" />}
              {item.source === 'client' && <User className="w-3 h-3 mr-1" />}
              {item.source.toUpperCase()}
            </Badge>
            <Badge 
              variant="outline"
              className={getStatusColor(item.status as CartItemStatus)}
              data-testid={`badge-status-${item.id}`}
            >
              {item.status && statusLabels[item.status as CartItemStatus] ? statusLabels[item.status as CartItemStatus] : (item.status || 'active')}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground mb-2">
            <Badge variant="secondary" className="mr-2">
              {categoryLabels[item.productCategory as ProductCategory] || item.productCategory}
            </Badge>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>

          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <p className="text-sm text-muted-foreground mb-2" data-testid={`text-description-${item.id}`}>
              {(item.metadata as any)?.description || (item.metadata as any)?.fundHouse || (item.metadata as any)?.companyName || ''}
            </p>
          )}

          <div className="flex items-center gap-6 text-sm">
            <span data-testid={`text-qty-${item.id}`}>
              <strong>Qty:</strong> {item.quantity || 1}
            </span>
            <span data-testid={`text-amount-${item.id}`}>
              <strong>Amount:</strong> ₹{Number(item.amount || 0).toLocaleString()}
            </span>
            <span className="text-lg font-bold text-finance-blue" data-testid={`text-total-${item.id}`}>
              Total: ₹{(Number(item.amount || 0) * (item.quantity || 1)).toLocaleString()}
            </span>
          </div>

          <StatusTimeline 
            status={item.status} 
            approvedAt={item.approvedAt} 
            createdAt={item.createdAt}
            source={item.source}
          />
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const { items, isLoading, error } = useUnifiedCart();
  const [location] = useLocation();
  
  const [filters, setFilters] = useState<OrderFilters>({
    category: 'all',
    status: 'all',
    source: 'all'
  });

  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tabFromUrl = urlParams.get('tab') || 'all';
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location]);

  const filteredItems = items.filter(item => {
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.source !== 'all' && item.source !== filters.source) return false;
    if (activeTab !== 'all' && item.productCategory !== activeTab) return false;
    return true;
  });

  const categoryStats = {
    all: items.length,
    store: items.filter(i => i.productCategory === 'store').length,
    unlisted: items.filter(i => i.productCategory === 'unlisted').length,
    mutual_fund: items.filter(i => i.productCategory === 'mutual_fund').length,
    bond: items.filter(i => i.productCategory === 'bond').length,
    ncd: items.filter(i => i.productCategory === 'ncd').length,
    ipo: items.filter(i => i.productCategory === 'ipo').length,
  };

  const statusStats = {
    active: items.filter(i => i.status === 'active').length,
    pending_approval: items.filter(i => i.status === 'pending_approval').length,
    removed: items.filter(i => i.status === 'removed').length,
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-red-600">Failed to load orders. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="orders-page">
      <div className="mb-6">
        <Link href="/cart">
          <Button variant="ghost" className="mb-4" data-testid="button-back-to-cart">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground mb-2">Order Tracking</h1>
        <p className="text-muted-foreground">Track your investments and orders across all categories</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card data-testid="stat-total-orders">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-orders">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusStats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-orders">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusStats.pending_approval}</p>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-value">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{items.reduce((sum, item) => sum + Number(item.amount || 0) * (item.quantity || 1), 0).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select 
          value={filters.status} 
          onValueChange={(v) => setFilters(prev => ({ ...prev, status: v as OrderFilters['status'] }))}
        >
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="removed">Removed</SelectItem>
          </SelectContent>
        </Select>
        <Select 
          value={filters.source} 
          onValueChange={(v) => setFilters(prev => ({ ...prev, source: v as OrderFilters['source'] }))}
        >
          <SelectTrigger className="w-[180px]" data-testid="select-source-filter">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
          </SelectContent>
        </Select>
        {(filters.status !== 'all' || filters.source !== 'all') && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFilters({ category: 'all', status: 'all', source: 'all' })}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollableTabsList className="w-full">
          <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
            <ShoppingCart className="w-4 h-4" />
            All ({categoryStats.all})
          </TabsTrigger>
          <TabsTrigger value="mutual_fund" className="flex items-center gap-2" data-testid="tab-mutual-fund">
            <Coins className="w-4 h-4" />
            MF ({categoryStats.mutual_fund})
          </TabsTrigger>
          <TabsTrigger value="bond" className="flex items-center gap-2" data-testid="tab-bond">
            <FileText className="w-4 h-4" />
            Bonds ({categoryStats.bond})
          </TabsTrigger>
          <TabsTrigger value="ncd" className="flex items-center gap-2" data-testid="tab-ncd">
            <Landmark className="w-4 h-4" />
            NCDs ({categoryStats.ncd})
          </TabsTrigger>
          <TabsTrigger value="ipo" className="flex items-center gap-2" data-testid="tab-ipo">
            <TrendingUp className="w-4 h-4" />
            IPOs ({categoryStats.ipo})
          </TabsTrigger>
          <TabsTrigger value="unlisted" className="flex items-center gap-2" data-testid="tab-unlisted">
            <Building2 className="w-4 h-4" />
            Unlisted ({categoryStats.unlisted})
          </TabsTrigger>
          <TabsTrigger value="store" className="flex items-center gap-2" data-testid="tab-store">
            <Package className="w-4 h-4" />
            Store ({categoryStats.store})
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">No orders found</h2>
                <p className="text-muted-foreground mb-6">
                  {activeTab === 'all' 
                    ? 'Start investing to see your orders here' 
                    : `No ${categoryLabels[activeTab as ProductCategory] || activeTab} orders found`}
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <Link href="/mutual-funds">
                    <Button variant="outline" data-testid="button-browse-mf">
                      <Coins className="w-4 h-4 mr-2" />
                      Mutual Funds
                    </Button>
                  </Link>
                  <Link href="/bonds">
                    <Button variant="outline" data-testid="button-browse-bonds">
                      <FileText className="w-4 h-4 mr-2" />
                      Bonds
                    </Button>
                  </Link>
                  <Link href="/unlisted">
                    <Button variant="outline" data-testid="button-browse-unlisted">
                      <Building2 className="w-4 h-4 mr-2" />
                      Unlisted
                    </Button>
                  </Link>
                  <Link href="/store">
                    <Button variant="outline" data-testid="button-browse-store">
                      <Package className="w-4 h-4 mr-2" />
                      Store
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <OrderCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
