import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Package, FolderTree, Search, Loader2, Pencil, Save, X } from "lucide-react";

export default function StoreManagement() {
  const { toast } = useToast();
  const [productsSearch, setProductsSearch] = useState("");
  const [categoriesSearch, setCategoriesSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editMarkup, setEditMarkup] = useState<string>("");
  const [editMarkupType, setEditMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [bulkMarkup, setBulkMarkup] = useState<string>("");
  const [bulkMarkupType, setBulkMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  // Fetch all store products
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['/api/admin/store-products'],
  });

  // Fetch all store categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/admin/store-categories'],
  });

  // Update product status mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest('PATCH', `/api/admin/store-products/${id}`, { body: { isActive } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store-products'] });
      toast({
        title: "Success",
        description: "Product status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product status",
        variant: "destructive",
      });
    },
  });

  // Update category status mutation
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest('PATCH', `/api/admin/store-categories/${id}`, { body: { isActive } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store-categories'] });
      toast({
        title: "Success",
        description: "Category status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category status",
        variant: "destructive",
      });
    },
  });

  // Update product markup mutation
  const updateMarkupMutation = useMutation({
    mutationFn: ({ id, markup, markupType }: { id: string; markup: number; markupType: "percentage" | "fixed" }) =>
      apiRequest('PATCH', `/api/admin/store-products/${id}/markup`, { body: { markup, markupType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store-products'] });
      setEditingProduct(null);
      setEditMarkup("");
      toast({
        title: "Success",
        description: "Product markup updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update markup",
        variant: "destructive",
      });
    },
  });

  // Bulk update markup mutation
  const bulkUpdateMarkupMutation = useMutation({
    mutationFn: ({ productIds, markup, markupType }: { productIds: string[]; markup: number; markupType: "percentage" | "fixed" }) =>
      apiRequest('POST', `/api/admin/store-products/bulk-markup`, { body: { productIds, markup, markupType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store-products'] });
      setBulkDialogOpen(false);
      setBulkMarkup("");
      toast({
        title: "Success",
        description: "Bulk markup updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update bulk markup",
        variant: "destructive",
      });
    },
  });

  const handleSaveMarkup = (productId: string) => {
    const markup = parseFloat(editMarkup);
    if (isNaN(markup) || markup < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid markup value",
        variant: "destructive",
      });
      return;
    }
    updateMarkupMutation.mutate({ id: productId, markup, markupType: editMarkupType });
  };

  const handleStartEdit = (product: any) => {
    setEditingProduct(product.id);
    setEditMarkup(product.markup?.toString() || "0");
    setEditMarkupType(product.markupType || "percentage");
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditMarkup("");
  };

  const handleBulkUpdate = () => {
    const markup = parseFloat(bulkMarkup);
    if (isNaN(markup) || markup < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid markup value",
        variant: "destructive",
      });
      return;
    }
    const productIds = filteredProducts.map((p: any) => p.id);
    bulkUpdateMarkupMutation.mutate({ productIds, markup, markupType: bulkMarkupType });
  };

  // Filter products based on search
  const filteredProducts = products.filter((product: any) =>
    product.name?.toLowerCase().includes(productsSearch.toLowerCase()) ||
    product.productType?.toLowerCase().includes(productsSearch.toLowerCase()) ||
    product.provider?.toLowerCase().includes(productsSearch.toLowerCase())
  );

  // Filter categories based on search
  const filteredCategories = categories.filter((category: any) =>
    category.name?.toLowerCase().includes(categoriesSearch.toLowerCase()) ||
    category.slug?.toLowerCase().includes(categoriesSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white" data-testid="heading-store-management">Store Management</h1>
        <p className="text-gray-400 mt-1">Manage products and categories visibility</p>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-gray-900 border-gray-800">
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="w-4 h-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center">
                    <span>Store Products</span>
                    <Badge variant="outline" className="ml-2 text-blue-400 border-blue-400">
                      {filteredProducts.length} total
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-1">
                    Manage product markup and visibility
                  </CardDescription>
                </div>
                <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-blue-600 text-white border-blue-500 hover:bg-blue-700" data-testid="button-bulk-markup">
                      Bulk Markup Update
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-900 border-gray-800 text-white">
                    <DialogHeader>
                      <DialogTitle>Bulk Markup Update</DialogTitle>
                      <DialogDescription className="text-gray-400">
                        Apply markup to all {filteredProducts.length} products in the current view
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="bulk-markup-type">Markup Type</Label>
                        <Select value={bulkMarkupType} onValueChange={(value: "percentage" | "fixed") => setBulkMarkupType(value)}>
                          <SelectTrigger id="bulk-markup-type" className="bg-gray-800 border-gray-700" data-testid="select-bulk-markup-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bulk-markup">Markup Value</Label>
                        <Input
                          id="bulk-markup"
                          type="number"
                          step="0.01"
                          min="0"
                          value={bulkMarkup}
                          onChange={(e) => setBulkMarkup(e.target.value)}
                          placeholder={bulkMarkupType === "percentage" ? "e.g., 10 for 10%" : "e.g., 100 for ₹100"}
                          className="bg-gray-800 border-gray-700 text-white"
                          data-testid="input-bulk-markup"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBulkDialogOpen(false)} className="border-gray-700" data-testid="button-cancel-bulk">
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBulkUpdate}
                        disabled={bulkUpdateMarkupMutation.isPending || !bulkMarkup}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-apply-bulk"
                      >
                        {bulkUpdateMarkupMutation.isPending ? "Applying..." : "Apply to All"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search products by name, type, or provider..."
                  value={productsSearch}
                  onChange={(e) => setProductsSearch(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  data-testid="input-search-products"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="ml-2 text-gray-400">Loading products...</span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  {productsSearch ? "No products found matching your search" : "No products available"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800/50">
                        <TableHead className="text-gray-400">Product Name</TableHead>
                        <TableHead className="text-gray-400">Category</TableHead>
                        <TableHead className="text-gray-400">Base Price</TableHead>
                        <TableHead className="text-gray-400">Markup</TableHead>
                        <TableHead className="text-gray-400">Final Price</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product: any) => {
                        const isEditing = editingProduct === product.id;
                        const basePrice = parseFloat(product.basePrice || product.price || 0);
                        const finalPrice = parseFloat(product.finalPrice || basePrice);
                        
                        return (
                          <TableRow
                            key={product.id}
                            className="border-gray-800 hover:bg-gray-800/50"
                            data-testid={`row-product-${product.id}`}
                          >
                            <TableCell className="font-medium text-white" data-testid={`text-product-name-${product.id}`}>
                              <div>{product.name}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                {product.provider || product.subCategory || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {product.category || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-300">
                              ₹{basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editMarkup}
                                    onChange={(e) => setEditMarkup(e.target.value)}
                                    className="w-20 bg-gray-800 border-gray-700 text-white"
                                    data-testid={`input-markup-${product.id}`}
                                  />
                                  <Select value={editMarkupType} onValueChange={(value: "percentage" | "fixed") => setEditMarkupType(value)}>
                                    <SelectTrigger className="w-16 bg-gray-800 border-gray-700" data-testid={`select-markup-type-${product.id}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700">
                                      <SelectItem value="percentage">%</SelectItem>
                                      <SelectItem value="fixed">₹</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <div className="text-gray-300">
                                  {product.markup ? (
                                    <span>
                                      {product.markupType === "percentage" 
                                        ? `${product.markup}%` 
                                        : `₹${parseFloat(product.markup).toLocaleString('en-IN')}`}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">No markup</span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-green-400 font-medium">
                              ₹{finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={product.isActive ? "default" : "secondary"}
                                className={product.isActive ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}
                                data-testid={`badge-status-${product.id}`}
                              >
                                {product.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSaveMarkup(product.id)}
                                      disabled={updateMarkupMutation.isPending}
                                      className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                      data-testid={`button-save-markup-${product.id}`}
                                    >
                                      <Save className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelEdit}
                                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                      data-testid={`button-cancel-markup-${product.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEdit(product)}
                                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                      data-testid={`button-edit-markup-${product.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Switch
                                      checked={product.isActive}
                                      onCheckedChange={(checked) => {
                                        updateProductMutation.mutate({ id: product.id, isActive: checked });
                                      }}
                                      disabled={updateProductMutation.isPending}
                                      data-testid={`toggle-product-${product.id}`}
                                    />
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Store Categories</span>
                <Badge variant="outline" className="ml-2 text-purple-400 border-purple-400">
                  {filteredCategories.length} total
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Toggle categories on/off to control their visibility in the store
              </CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search categories by name or slug..."
                  value={categoriesSearch}
                  onChange={(e) => setCategoriesSearch(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  data-testid="input-search-categories"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCategories ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  <span className="ml-2 text-gray-400">Loading categories...</span>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  {categoriesSearch ? "No categories found matching your search" : "No categories available"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800 hover:bg-gray-800/50">
                        <TableHead className="text-gray-400">Category Name</TableHead>
                        <TableHead className="text-gray-400">Slug</TableHead>
                        <TableHead className="text-gray-400">Description</TableHead>
                        <TableHead className="text-gray-400">Display Order</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((category: any) => (
                        <TableRow
                          key={category.id}
                          className="border-gray-800 hover:bg-gray-800/50"
                          data-testid={`row-category-${category.id}`}
                        >
                          <TableCell className="font-medium text-white" data-testid={`text-category-name-${category.id}`}>
                            {category.name}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-400">
                              {category.slug}
                            </code>
                          </TableCell>
                          <TableCell className="text-gray-300 max-w-xs truncate">
                            {category.description || 'No description'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {category.displayOrder ?? 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={category.isActive ? "default" : "secondary"}
                              className={category.isActive ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}
                              data-testid={`badge-status-${category.id}`}
                            >
                              {category.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-400">
                                {category.isActive ? "Visible" : "Hidden"}
                              </span>
                              <Switch
                                checked={category.isActive}
                                onCheckedChange={(checked) => {
                                  updateCategoryMutation.mutate({ id: category.id, isActive: checked });
                                }}
                                disabled={updateCategoryMutation.isPending}
                                data-testid={`toggle-category-${category.id}`}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
