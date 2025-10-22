import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Package, FolderTree, Search, Loader2 } from "lucide-react";

export default function StoreManagement() {
  const { toast } = useToast();
  const [productsSearch, setProductsSearch] = useState("");
  const [categoriesSearch, setCategoriesSearch] = useState("");

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
              <CardTitle className="text-white flex items-center justify-between">
                <span>Store Products</span>
                <Badge variant="outline" className="ml-2 text-blue-400 border-blue-400">
                  {filteredProducts.length} total
                </Badge>
              </CardTitle>
              <CardDescription className="text-gray-400">
                Toggle products on/off to control their visibility in the store
              </CardDescription>
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
                        <TableHead className="text-gray-400">Type</TableHead>
                        <TableHead className="text-gray-400">Provider</TableHead>
                        <TableHead className="text-gray-400">Price</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product: any) => (
                        <TableRow
                          key={product.id}
                          className="border-gray-800 hover:bg-gray-800/50"
                          data-testid={`row-product-${product.id}`}
                        >
                          <TableCell className="font-medium text-white" data-testid={`text-product-name-${product.id}`}>
                            {product.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product.productType || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {product.provider || 'N/A'}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {product.price ? `₹${parseFloat(product.price).toLocaleString()}` : 'N/A'}
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
                              <span className="text-xs text-gray-400">
                                {product.isActive ? "Visible" : "Hidden"}
                              </span>
                              <Switch
                                checked={product.isActive}
                                onCheckedChange={(checked) => {
                                  updateProductMutation.mutate({ id: product.id, isActive: checked });
                                }}
                                disabled={updateProductMutation.isPending}
                                data-testid={`toggle-product-${product.id}`}
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
