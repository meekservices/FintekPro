import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, 
  ShoppingCart, 
  Handshake, 
  History, 
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Landmark,
  ArrowRight
} from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { queryClient } from "@/lib/queryClient";

export default function BondMarketplaceDashboard() {
  const { data: stats, isLoading } = useQuery<{
    totalSellListings: number;
    totalBuyRequests: number;
    totalDeals: number;
    activeSellListings: number;
    activeBuyRequests: number;
    pendingDeals: number;
    totalVolume: string;
  }>({
    queryKey: ['/api/bonds/admin/stats'],
  });

  if (isLoading) {
    return <LoadingState variant="card" count={4} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bond Marketplace Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage bond sell listings, buy requests, and deals</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/bonds/admin/stats'] });
          }}
          data-testid="btn-refresh-bond-dashboard"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Store className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.activeSellListings || 0}</p>
                <p className="text-sm text-muted-foreground">Active Sell Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.activeBuyRequests || 0}</p>
                <p className="text-sm text-muted-foreground">Active Buy Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Handshake className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendingDeals || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{parseFloat(stats?.totalVolume || '0').toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Volume</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>Sell Listings</CardTitle>
                <CardDescription>Manage investor sell listings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline">{stats?.totalSellListings || 0} Total</Badge>
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{stats?.activeSellListings || 0} Active</Badge>
            </div>
            <Link href="/admin/bonds/sell-listings">
              <Button className="w-full" data-testid="btn-go-sell-listings">
                Manage Sell Listings
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle>Buy Requests</CardTitle>
                <CardDescription>Manage investor buy requests</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline">{stats?.totalBuyRequests || 0} Total</Badge>
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{stats?.activeBuyRequests || 0} Active</Badge>
            </div>
            <Link href="/admin/bonds/buy-requests">
              <Button className="w-full" variant="outline" data-testid="btn-go-buy-requests">
                Manage Buy Requests
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Handshake className="h-8 w-8 text-purple-600" />
              <div>
                <CardTitle>Deals</CardTitle>
                <CardDescription>Matched deals & settlements</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="outline">{stats?.totalDeals || 0} Total</Badge>
              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{stats?.pendingDeals || 0} Pending</Badge>
            </div>
            <Link href="/admin/bonds/deals">
              <Button className="w-full" variant="outline" data-testid="btn-go-deals">
                Manage Deals
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-muted-foreground" />
            <div>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>7-year SEBI/RBI compliant audit log retention</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/admin/bonds/audit-log">
            <Button variant="outline" data-testid="btn-go-audit-log">
              <History className="h-4 w-4 mr-2" />
              View Audit Log
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
