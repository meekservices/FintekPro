import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Package, 
  Users, 
  Star, 
  Eye, 
  Edit, 
  Plus,
  Target,
  BarChart3,
  PieChart,
  Megaphone,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Phone,
  Mail,
  Calendar,
  Filter,
  ArrowUpDown
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  productCategories: string[];
  performanceRating: number;
  commissionRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductPerformance {
  id: string;
  productId: string;
  supplierId: string;
  productName: string;
  supplierName: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  profitMargin: number;
  salesVolume: number;
  revenue: number;
  monthlyPerformance?: any;
  lastSaleDate?: string;
  isPromoted: boolean;
  promotionStartDate?: string;
  promotionEndDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductOptimizationSuggestion {
  productId: string;
  productName: string;
  currentMargin: number;
  suggestedAction: string;
  potentialRevenue: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export default function SupplierDashboard() {
  const { toast } = useToast();
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("profitMargin");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch suppliers
  const { data: suppliersData, isLoading: suppliersLoading } = useQuery<any>({
    queryKey: ['/api/admin/suppliers'],
  });
  const suppliers = Array.isArray(suppliersData) ? suppliersData : (suppliersData?.suppliers || []);

  // Fetch product performance data
  const { data: productPerformanceData, isLoading: performanceLoading } = useQuery<any>({
    queryKey: ['/api/admin/product-performance', selectedSupplier],
  });
  const productPerformance = Array.isArray(productPerformanceData) ? productPerformanceData : (productPerformanceData?.performance || []);

  // Fetch optimization suggestions
  const { data: optimizationSuggestionsData, isLoading: suggestionsLoading } = useQuery<any>({
    queryKey: ['/api/admin/product-optimization'],
  });
  const optimizationSuggestions = Array.isArray(optimizationSuggestionsData) ? optimizationSuggestionsData : (optimizationSuggestionsData?.suggestions || []);

  // Promote product mutation
  const promoteProductMutation = useMutation({
    mutationFn: async ({ productId, duration }: { productId: string; duration: number }) => {
      await apiRequest(`/api/admin/products/${productId}/promote`, { 
        method: "POST", 
        body: JSON.stringify({ duration }) 
      });
    },
    onSuccess: () => {
      toast({
        title: "Product promoted",
        description: "Product has been successfully promoted with high visibility."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/product-performance'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Promotion failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Calculate totals
  const totalRevenue = productPerformance?.reduce((sum, product) => sum + product.revenue, 0) || 0;
  const averageMargin = productPerformance?.reduce((sum, product) => sum + product.profitMargin, 0) / (productPerformance?.length || 1) || 0;
  const highMarginProducts = productPerformance?.filter(product => product.profitMargin > 15).length || 0;
  const promotedProducts = productPerformance?.filter(product => product.isPromoted).length || 0;

  const getProfitColor = (margin: number) => {
    if (margin >= 20) return "text-green-600";
    if (margin >= 10) return "text-yellow-600";
    return "text-red-600";
  };

  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-muted text-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Supplier Dashboard</h2>
          <p className="text-muted-foreground">Optimize product performance and profit margins</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-finance-blue hover:bg-finance-blue/90" data-testid="button-add-supplier">
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
                <DialogDescription>
                  Register a new supplier to track product performance and commissions.
                </DialogDescription>
              </DialogHeader>
              {/* Add supplier form would go here */}
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button>Add Supplier</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">₹{totalRevenue.toLocaleString()}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Profit Margin</p>
                <p className="text-2xl font-bold text-foreground">{averageMargin.toFixed(1)}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Margin Products</p>
                <p className="text-2xl font-bold text-foreground">{highMarginProducts}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Promoted Products</p>
                <p className="text-2xl font-bold text-foreground">{promotedProducts}</p>
              </div>
              <Megaphone className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="performance" data-testid="tab-product-performance">
            <BarChart3 className="w-4 h-4 mr-2" />
            Product Performance
          </TabsTrigger>
          <TabsTrigger value="optimization" data-testid="tab-optimization">
            <Target className="w-4 h-4 mr-2" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">
            <Building2 className="w-4 h-4 mr-2" />
            Suppliers
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Product Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Product Performance Analysis</CardTitle>
                  <CardDescription>Track sales, profit margins, and revenue by product</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="w-48" data-testid="select-supplier-filter">
                      <SelectValue placeholder="Filter by supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48" data-testid="select-sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profitMargin">Profit Margin</SelectItem>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="salesVolume">Sales Volume</SelectItem>
                      <SelectItem value="lastSaleDate">Last Sale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {performanceLoading ? (
                <div className="text-center py-8">Loading product performance...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Profit Margin</TableHead>
                      <TableHead>Sales Volume</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productPerformance?.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-sm text-muted-foreground">{product.category}</p>
                          </div>
                        </TableCell>
                        <TableCell>{product.supplierName}</TableCell>
                        <TableCell>₹{product.costPrice.toLocaleString()}</TableCell>
                        <TableCell>₹{product.sellingPrice.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getProfitColor(product.profitMargin)}`}>
                            {product.profitMargin.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>{product.salesVolume}</TableCell>
                        <TableCell>₹{product.revenue.toLocaleString()}</TableCell>
                        <TableCell>
                          {product.isPromoted ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Megaphone className="h-3 w-3 mr-1" />
                              Promoted
                            </Badge>
                          ) : product.profitMargin >= 20 ? (
                            <Badge className="bg-green-100 text-green-800">High Margin</Badge>
                          ) : product.profitMargin >= 10 ? (
                            <Badge className="bg-yellow-100 text-yellow-800">Medium Margin</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Low Margin</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => promoteProductMutation.mutate({ productId: product.productId, duration: 30 })}
                              disabled={product.isPromoted}
                              data-testid={`button-promote-${product.productId}`}
                            >
                              <Megaphone className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`button-edit-${product.productId}`}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Optimization Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Optimization Suggestions
                </CardTitle>
                <CardDescription>AI-powered recommendations to maximize profits</CardDescription>
              </CardHeader>
              <CardContent>
                {suggestionsLoading ? (
                  <div className="text-center py-8">Analyzing product data...</div>
                ) : (
                  <div className="space-y-4">
                    {optimizationSuggestions?.map((suggestion, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-foreground">{suggestion.productName}</h4>
                          <Badge className={getPriorityBadge(suggestion.priority)}>
                            {(suggestion.priority || 'medium').toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{suggestion.reason}</p>
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Current Margin: {suggestion.currentMargin}%</p>
                            <p className="text-sm text-green-600">Potential Revenue: ₹{suggestion.potentialRevenue.toLocaleString()}</p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-finance-blue hover:bg-finance-blue/90"
                            onClick={() => promoteProductMutation.mutate({ productId: suggestion.productId, duration: 30 })}
                            data-testid={`button-apply-suggestion-${suggestion.productId}`}
                          >
                            {suggestion.suggestedAction}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">High Margin Products (&gt;20%)</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(highMarginProducts / (productPerformance?.length || 1)) * 100} className="w-24" />
                      <span className="text-sm font-medium">{highMarginProducts}</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Currently Promoted</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(promotedProducts / (productPerformance?.length || 1)) * 100} className="w-24" />
                      <span className="text-sm font-medium">{promotedProducts}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Average Performance</span>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(averageMargin * 5, 100)} className="w-24" />
                      <span className="text-sm font-medium">{averageMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-3">Top Performing Categories</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Mutual Funds</span>
                      <span className="text-sm font-medium text-green-600">22.5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Insurance</span>
                      <span className="text-sm font-medium text-green-600">18.3%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Fixed Deposits</span>
                      <span className="text-sm font-medium text-yellow-600">12.1%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Promote high-margin products and optimize performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  className="h-20 flex flex-col gap-2 bg-green-600 hover:bg-green-700"
                  data-testid="button-promote-high-margin"
                >
                  <Target className="h-6 w-6" />
                  <span className="text-sm">Promote High Margin Products</span>
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  data-testid="button-analyze-performance"
                >
                  <BarChart3 className="h-6 w-6" />
                  <span className="text-sm">Analyze Performance</span>
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-20 flex flex-col gap-2"
                  data-testid="button-generate-report"
                >
                  <PieChart className="h-6 w-6" />
                  <span className="text-sm">Generate Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Management Tab */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Supplier Management
              </CardTitle>
              <CardDescription>Manage supplier relationships and commission rates</CardDescription>
            </CardHeader>
            <CardContent>
              {suppliersLoading ? (
                <div className="text-center py-8">Loading suppliers...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier Name</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Performance Rating</TableHead>
                      <TableHead>Commission Rate</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers?.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{supplier.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {supplier.productCategories.slice(0, 2).map((category, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {category}
                              </Badge>
                            ))}
                            {supplier.productCategories.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{supplier.productCategories.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span>{supplier.performanceRating}/5.0</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{supplier.commissionRate}%</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {supplier.contactEmail && (
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span>{supplier.contactEmail}</span>
                              </div>
                            )}
                            {supplier.contactPhone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                <span>{supplier.contactPhone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.isActive ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" data-testid={`button-view-supplier-${supplier.id}`}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`button-edit-supplier-${supplier.id}`}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}