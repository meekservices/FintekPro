import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Package, FolderTree, Search, Loader2, ChevronRight, ChevronDown, 
  AlertTriangle, History, Eye, EyeOff, FileText, RefreshCw,
  Plus, Edit, Trash2, ArrowLeft
} from "lucide-react";
import { format } from "date-fns";

interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
}

interface Product {
  id: string;
  categoryId: string;
  subcategoryId?: string;
  name: string;
  shortDescription?: string;
  description?: string;
  productType?: string;
  icon?: string;
  displayOrder?: number;
  isActive: boolean;
}

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  beforeValue?: any;
  afterValue?: any;
  timestamp: string;
}

export default function StoreManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hierarchy");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'category' | 'subcategory' | 'product';
    item: any;
    action: 'enable' | 'disable';
  } | null>(null);

  // Fetch categories with subcategories
  const { data: categoriesData, isLoading: isLoadingCategories, refetch: refetchCategories } = useQuery<{ categories: Category[] }>({
    queryKey: ['/api/admin/store/categories'],
  });

  // Fetch all products
  const { data: productsData, isLoading: isLoadingProducts } = useQuery<{ products: Product[] }>({
    queryKey: ['/api/admin/store/products'],
  });

  // Fetch audit logs
  const { data: auditLogsData, isLoading: isLoadingAuditLogs } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ['/api/admin/store/audit-logs'],
  });

  const categories: Category[] = categoriesData?.categories || [];
  const products: Product[] = productsData?.products || [];
  const auditLogs: AuditLog[] = auditLogsData?.logs || [];

  // Toggle category with cascade
  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/categories/${id}/toggle`, { 
        method: 'POST',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Category Updated",
        description: data?.message || "Category and all children updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  // Toggle subcategory with cascade
  const toggleSubcategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/subcategories/${id}/toggle`, { 
        method: 'POST',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/categories'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Subcategory Updated",
        description: data?.message || "Subcategory and products updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subcategory",
        variant: "destructive",
      });
    },
  });

  // Toggle single product
  const toggleProductMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest(`/api/admin/store/products/${id}/toggle`, { 
        method: 'POST',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/audit-logs'] });
      toast({
        title: "Product Updated",
        description: "Product visibility updated successfully",
      });
      setConfirmDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const toggleExpanded = (type: 'category' | 'subcategory', id: string) => {
    if (type === 'category') {
      setExpandedCategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } else {
      setExpandedSubcategories(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }
  };

  const handleToggle = (type: 'category' | 'subcategory' | 'product', item: any, newState: boolean) => {
    // For disabling, show confirmation dialog
    if (!newState && (type === 'category' || type === 'subcategory')) {
      setConfirmDialog({
        open: true,
        type,
        item,
        action: 'disable',
      });
    } else if (newState && (type === 'category' || type === 'subcategory')) {
      // For enabling categories/subcategories, show confirmation too
      setConfirmDialog({
        open: true,
        type,
        item,
        action: 'enable',
      });
    } else {
      // For products, toggle directly
      toggleProductMutation.mutate({ id: item.id, isActive: newState });
    }
  };

  const confirmToggle = () => {
    if (!confirmDialog) return;
    
    const isActive = confirmDialog.action === 'enable';
    
    if (confirmDialog.type === 'category') {
      toggleCategoryMutation.mutate({ id: confirmDialog.item.id, isActive });
    } else if (confirmDialog.type === 'subcategory') {
      toggleSubcategoryMutation.mutate({ id: confirmDialog.item.id, isActive });
    }
  };

  const getProductsForSubcategory = (subcategoryId: string) => {
    return products.filter(p => p.subcategoryId === subcategoryId);
  };

  const getProductsForCategoryDirectly = (categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId && !p.subcategoryId);
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'toggle': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cascade_toggle': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'create': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'update': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'delete': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="heading-store-management">Store Management</h1>
          <p className="text-gray-400 mt-1">Control product and category visibility across all portals</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchCategories()}
          className="border-gray-700 hover:bg-gray-800"
          data-testid="button-refresh"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-gray-900 border-gray-800">
          <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">
            <FolderTree className="w-4 h-4 mr-2" />
            Hierarchy
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="w-4 h-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Hierarchy Tab - Category/Subcategory/Product Tree */}
        <TabsContent value="hierarchy">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Category Hierarchy</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-blue-400 border-blue-400">
                    {categories.length} Categories
                  </Badge>
                  <Badge variant="outline" className="text-purple-400 border-purple-400">
                    {products.length} Products
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage your store hierarchy. Disabling a category will cascade to all subcategories and products.
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  data-testid="input-search-hierarchy"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCategories || isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="ml-2 text-gray-400">Loading hierarchy...</span>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FolderTree className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No categories found</p>
                  <p className="text-sm mt-2">Create categories to organize your store products</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {filteredCategories.map((category) => (
                      <div key={category.id} className="border border-gray-800 rounded-lg overflow-hidden">
                        {/* Category Row */}
                        <div 
                          className={`flex items-center justify-between p-4 ${
                            category.isActive ? 'bg-gray-800/50' : 'bg-gray-900/80'
                          }`}
                          data-testid={`row-category-${category.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleExpanded('category', category.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                              data-testid={`expand-category-${category.id}`}
                            >
                              {expandedCategories.has(category.id) ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                            <div className="flex items-center gap-2">
                              <FolderTree className={`w-5 h-5 ${category.isActive ? 'text-blue-400' : 'text-gray-600'}`} />
                              <div>
                                <p className={`font-medium ${category.isActive ? 'text-white' : 'text-gray-500'}`}>
                                  {category.name}
                                </p>
                                {category.description && (
                                  <p className="text-xs text-gray-500 truncate max-w-md">
                                    {category.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Badge variant="outline" className="text-xs">
                                {(category.subcategories || []).length} subcategories
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {getProductsForCategoryDirectly(category.id).length + 
                                  (category.subcategories || []).reduce((acc, sub) => 
                                    acc + getProductsForSubcategory(sub.id).length, 0
                                  )} products
                              </Badge>
                            </div>
                            <Badge
                              className={category.isActive 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                                : 'bg-red-500/20 text-red-400 border-red-500/30'}
                            >
                              {category.isActive ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
                              {category.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                            <Switch
                              checked={category.isActive}
                              onCheckedChange={(checked) => handleToggle('category', category, checked)}
                              disabled={toggleCategoryMutation.isPending}
                              data-testid={`toggle-category-${category.id}`}
                            />
                          </div>
                        </div>

                        {/* Expanded Category Content */}
                        {expandedCategories.has(category.id) && (
                          <div className="border-t border-gray-800 bg-gray-900/30">
                            {/* Subcategories */}
                            {(category.subcategories || []).map((subcategory) => (
                              <div key={subcategory.id}>
                                <div 
                                  className={`flex items-center justify-between p-3 pl-12 border-b border-gray-800/50 ${
                                    subcategory.isActive && category.isActive ? 'bg-gray-800/30' : 'bg-gray-900/50'
                                  }`}
                                  data-testid={`row-subcategory-${subcategory.id}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => toggleExpanded('subcategory', subcategory.id)}
                                      className="p-1 hover:bg-gray-700 rounded"
                                      data-testid={`expand-subcategory-${subcategory.id}`}
                                    >
                                      {expandedSubcategories.has(subcategory.id) ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                      )}
                                    </button>
                                    <div className="flex items-center gap-2">
                                      <FolderTree className={`w-4 h-4 ${subcategory.isActive && category.isActive ? 'text-purple-400' : 'text-gray-600'}`} />
                                      <span className={subcategory.isActive && category.isActive ? 'text-gray-200' : 'text-gray-500'}>
                                        {subcategory.name}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <Badge variant="outline" className="text-xs">
                                      {getProductsForSubcategory(subcategory.id).length} products
                                    </Badge>
                                    {!category.isActive && (
                                      <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                        Parent Disabled
                                      </Badge>
                                    )}
                                    <Switch
                                      checked={subcategory.isActive}
                                      onCheckedChange={(checked) => handleToggle('subcategory', subcategory, checked)}
                                      disabled={!category.isActive || toggleSubcategoryMutation.isPending}
                                      data-testid={`toggle-subcategory-${subcategory.id}`}
                                    />
                                  </div>
                                </div>

                                {/* Products in Subcategory */}
                                {expandedSubcategories.has(subcategory.id) && (
                                  <div className="pl-20 py-2 space-y-1">
                                    {getProductsForSubcategory(subcategory.id).map((product) => (
                                      <div 
                                        key={product.id}
                                        className={`flex items-center justify-between p-2 rounded ${
                                          product.isActive && subcategory.isActive && category.isActive 
                                            ? 'bg-gray-800/20' 
                                            : 'bg-gray-900/30'
                                        }`}
                                        data-testid={`row-product-${product.id}`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <Package className={`w-3 h-3 ${
                                            product.isActive && subcategory.isActive && category.isActive 
                                              ? 'text-green-400' 
                                              : 'text-gray-600'
                                          }`} />
                                          <span className={`text-sm ${
                                            product.isActive && subcategory.isActive && category.isActive 
                                              ? 'text-gray-300' 
                                              : 'text-gray-500'
                                          }`}>
                                            {product.name}
                                          </span>
                                          {product.productType && (
                                            <Badge variant="outline" className="text-xs">
                                              {product.productType}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {(!category.isActive || !subcategory.isActive) && (
                                            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                              Parent Disabled
                                            </Badge>
                                          )}
                                          <Switch
                                            checked={product.isActive}
                                            onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                            disabled={!category.isActive || !subcategory.isActive || toggleProductMutation.isPending}
                                            data-testid={`toggle-product-${product.id}`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                    {getProductsForSubcategory(subcategory.id).length === 0 && (
                                      <p className="text-xs text-gray-500 py-2">No products in this subcategory</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Direct Products (no subcategory) */}
                            {getProductsForCategoryDirectly(category.id).length > 0 && (
                              <div className="border-t border-gray-800/50 pl-12 py-2">
                                <p className="text-xs text-gray-500 mb-2 px-3">Direct Products (no subcategory)</p>
                                {getProductsForCategoryDirectly(category.id).map((product) => (
                                  <div 
                                    key={product.id}
                                    className={`flex items-center justify-between p-2 px-3 rounded ${
                                      product.isActive && category.isActive 
                                        ? 'bg-gray-800/20' 
                                        : 'bg-gray-900/30'
                                    }`}
                                    data-testid={`row-product-${product.id}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Package className={`w-3 h-3 ${
                                        product.isActive && category.isActive ? 'text-green-400' : 'text-gray-600'
                                      }`} />
                                      <span className={`text-sm ${
                                        product.isActive && category.isActive ? 'text-gray-300' : 'text-gray-500'
                                      }`}>
                                        {product.name}
                                      </span>
                                    </div>
                                    <Switch
                                      checked={product.isActive}
                                      onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                      disabled={!category.isActive || toggleProductMutation.isPending}
                                      data-testid={`toggle-product-${product.id}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {(category.subcategories || []).length === 0 && 
                              getProductsForCategoryDirectly(category.id).length === 0 && (
                              <p className="text-gray-500 text-center py-4">
                                No subcategories or products in this category
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab - Flat List */}
        <TabsContent value="products">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>All Products</span>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  {products.filter(p => p.isActive).length} / {products.length} Active
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                View and manage all products across all categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                  <span className="ml-2 text-gray-400">Loading products...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No products found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">Product</TableHead>
                        <TableHead className="text-gray-400">Type</TableHead>
                        <TableHead className="text-gray-400">Category</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 text-right">Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => {
                        const category = categories.find(c => c.id === product.categoryId);
                        const subcategory = category?.subcategories?.find(s => s.id === product.subcategoryId);
                        const isParentDisabled = !category?.isActive || (subcategory && !subcategory.isActive);
                        
                        return (
                          <TableRow 
                            key={product.id} 
                            className="border-gray-800"
                            data-testid={`row-product-${product.id}`}
                          >
                            <TableCell className="font-medium text-white">
                              <div className="flex items-center gap-2">
                                <Package className={`w-4 h-4 ${product.isActive ? 'text-green-400' : 'text-gray-600'}`} />
                                {product.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {product.productType || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400">
                              <div className="flex flex-col">
                                <span>{category?.name || 'Unknown'}</span>
                                {subcategory && (
                                  <span className="text-xs text-gray-500">→ {subcategory.name}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={product.isActive 
                                    ? 'bg-green-500/20 text-green-400' 
                                    : 'bg-red-500/20 text-red-400'}
                                >
                                  {product.isActive ? 'Active' : 'Disabled'}
                                </Badge>
                                {isParentDisabled && (
                                  <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                                    Parent Off
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={product.isActive}
                                onCheckedChange={(checked) => handleToggle('product', product, checked)}
                                disabled={isParentDisabled || toggleProductMutation.isPending}
                                data-testid={`toggle-product-${product.id}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Audit Log</span>
                <Badge variant="outline" className="text-amber-400 border-amber-400">
                  {auditLogs.length} Records
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Track all store management changes for compliance (7-year retention)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAuditLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <span className="ml-2 text-gray-400">Loading audit logs...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No audit logs yet</p>
                  <p className="text-sm mt-2">Changes to store items will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">Timestamp</TableHead>
                        <TableHead className="text-gray-400">Admin</TableHead>
                        <TableHead className="text-gray-400">Action</TableHead>
                        <TableHead className="text-gray-400">Target</TableHead>
                        <TableHead className="text-gray-400">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="border-gray-800"
                          data-testid={`row-audit-${log.id}`}
                        >
                          <TableCell className="text-gray-400 whitespace-nowrap">
                            {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {log.adminEmail}
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {log.targetType}
                              </Badge>
                              <span className="text-gray-300">{log.targetName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                                  <FileText className="w-4 h-4 mr-1" />
                                  View
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
                                <DialogHeader>
                                  <DialogTitle className="text-white">Audit Log Details</DialogTitle>
                                  <DialogDescription className="text-gray-400">
                                    Change details for {log.targetName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-sm text-gray-400 mb-1">Before</p>
                                    <pre className="bg-gray-800 p-3 rounded text-xs text-gray-300 overflow-auto max-h-32">
                                      {JSON.stringify(log.beforeValue, null, 2) || 'N/A'}
                                    </pre>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-400 mb-1">After</p>
                                    <pre className="bg-gray-800 p-3 rounded text-xs text-gray-300 overflow-auto max-h-32">
                                      {JSON.stringify(log.afterValue, null, 2) || 'N/A'}
                                    </pre>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Confirm {confirmDialog?.action === 'enable' ? 'Enable' : 'Disable'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {confirmDialog?.action === 'disable' ? (
                <>
                  Disabling <strong className="text-white">{confirmDialog?.item?.name}</strong> will also disable:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {confirmDialog?.type === 'category' && (
                      <>
                        <li>All subcategories under this category</li>
                        <li>All products under this category and its subcategories</li>
                      </>
                    )}
                    {confirmDialog?.type === 'subcategory' && (
                      <li>All products under this subcategory</li>
                    )}
                  </ul>
                  <p className="mt-3 text-yellow-400">Customers will see an inquiry form instead of these items.</p>
                </>
              ) : (
                <>
                  Enabling <strong className="text-white">{confirmDialog?.item?.name}</strong> will make it visible to customers.
                  {confirmDialog?.type === 'category' && (
                    <p className="mt-2">Note: Subcategories and products will need to be enabled individually.</p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmToggle}
              className={confirmDialog?.action === 'disable' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-green-600 hover:bg-green-700'}
              disabled={toggleCategoryMutation.isPending || toggleSubcategoryMutation.isPending}
            >
              {(toggleCategoryMutation.isPending || toggleSubcategoryMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {confirmDialog?.action === 'enable' ? 'Enable' : 'Disable'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
