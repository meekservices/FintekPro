import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Plus, Edit, Trash2, Save, RefreshCw, Settings, FileText, Scale, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  categoryCode: string;
  categoryName: string;
  weightPercentage: number;
  sortOrder: number;
  isActive: boolean;
}

interface Question {
  id: string;
  categoryId: string;
  questionCode: string;
  questionText: string;
  questionType: string;
  helpText?: string;
  isMandatory: boolean;
  sortOrder: number;
  isActive: boolean;
  options: QuestionOption[];
}

interface QuestionOption {
  id: string;
  optionCode: string;
  optionText: string;
  score: number;
  sortOrder: number;
}

interface ProductSuitability {
  id: string;
  productType: string;
  productTypeLabel: string;
  allowedRP1: boolean;
  allowedRP2: boolean;
  allowedRP3: boolean;
  allowedRP4: boolean;
  allowedRP5: boolean;
  minInvestmentAmount?: number;
  requiresAccreditedInvestor: boolean;
  requiresEnhancedKyc: boolean;
  sortOrder: number;
  isActive: boolean;
}

const CATEGORY_WEIGHTS = [
  { code: "age_demographics", name: "Age & Demographics", defaultWeight: 15 },
  { code: "income_stability", name: "Income Stability", defaultWeight: 20 },
  { code: "net_worth", name: "Net Worth", defaultWeight: 20 },
  { code: "investment_horizon", name: "Investment Horizon", defaultWeight: 20 },
  { code: "risk_tolerance", name: "Risk Tolerance", defaultWeight: 15 },
  { code: "investment_experience", name: "Investment Experience", defaultWeight: 10 },
];

export default function RiskQuestionnaireBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductSuitability | null>(null);
  const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({});
  const [isInitializing, setIsInitializing] = useState(false);

  const { data: categoriesResponse, isLoading: loadingCategories } = useQuery<{ success: boolean; data: Category[] }>({
    queryKey: ["/api/sebi-risk-profiling/admin/categories"],
  });
  const categories = categoriesResponse?.data;

  const { data: questionsResponse, isLoading: loadingQuestions } = useQuery<{ success: boolean; data: Question[] }>({
    queryKey: ["/api/sebi-risk-profiling/admin/questions"],
  });
  const questions = questionsResponse?.data;

  const { data: productsResponse, isLoading: loadingProducts } = useQuery<{ success: boolean; data: ProductSuitability[] }>({
    queryKey: ["/api/sebi-risk-profiling/admin/product-matrix"],
  });
  const products = productsResponse?.data;

  const initializeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/sebi-risk-profiling/initialize", { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sebi-risk-profiling"] });
      toast({ title: "Initialized", description: "Default questionnaire data created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async (category: Partial<Category>) => {
      const method = category.id ? "PUT" : "POST";
      const url = category.id 
        ? `/api/sebi-risk-profiling/admin/categories/${category.id}`
        : "/api/sebi-risk-profiling/admin/categories";
      return apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(category) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sebi-risk-profiling/admin/categories"] });
      setEditingCategory(null);
      toast({ title: "Saved", description: "Category updated successfully" });
    },
  });

  const saveWeightsMutation = useMutation({
    mutationFn: async (weights: Record<string, number>) => {
      return apiRequest("/api/sebi-risk-profiling/admin/category-weights", {
        method: "PUT",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sebi-risk-profiling/admin/categories"] });
      toast({ title: "Saved", description: "Category weights updated successfully" });
    },
  });

  const saveProductMutation = useMutation({
    mutationFn: async (product: Partial<ProductSuitability>) => {
      const method = product.id ? "PUT" : "POST";
      const url = product.id
        ? `/api/sebi-risk-profiling/admin/product-matrix/${product.id}`
        : "/api/sebi-risk-profiling/admin/product-matrix";
      return apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sebi-risk-profiling/admin/product-matrix"] });
      setEditingProduct(null);
      toast({ title: "Saved", description: "Product suitability updated" });
    },
  });

  const totalWeight = Object.values(categoryWeights).reduce((sum, w) => sum + w, 0);

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      await initializeMutation.mutateAsync();
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Risk Questionnaire Builder
          </h1>
          <p className="text-muted-foreground">
            Configure SEBI-compliant risk profiling questionnaire and product eligibility
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleInitialize}
            disabled={isInitializing}
            data-testid="button-initialize"
          >
            {isInitializing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Initialize Defaults
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories" data-testid="tab-categories">
            <Scale className="h-4 w-4 mr-2" />
            Category Weights
          </TabsTrigger>
          <TabsTrigger value="questions" data-testid="tab-questions">
            <FileText className="h-4 w-4 mr-2" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Shield className="h-4 w-4 mr-2" />
            Product Matrix
          </TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">
            <AlertTriangle className="h-4 w-4 mr-2" />
            SEBI Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Weight Calibration</CardTitle>
              <CardDescription>
                Adjust weights for each scoring category. Total must equal 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="font-medium">Total Weight</span>
                <div className="flex items-center gap-2">
                  <Progress value={totalWeight} className="w-32 h-2" />
                  <Badge variant={totalWeight === 100 ? "default" : "destructive"}>
                    {totalWeight}%
                  </Badge>
                </div>
              </div>

              {CATEGORY_WEIGHTS.map((cat) => (
                <div key={cat.code} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{cat.name}</Label>
                    <span className="text-sm font-medium">
                      {categoryWeights[cat.code] || cat.defaultWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[categoryWeights[cat.code] || cat.defaultWeight]}
                    onValueChange={(value) => {
                      setCategoryWeights((prev) => ({
                        ...prev,
                        [cat.code]: value[0],
                      }));
                    }}
                    max={50}
                    min={5}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCategoryWeights({})}
                  data-testid="button-reset-weights"
                >
                  Reset to Defaults
                </Button>
                <Button
                  onClick={() => saveWeightsMutation.mutate(categoryWeights)}
                  disabled={totalWeight !== 100 || saveWeightsMutation.isPending}
                  data-testid="button-save-weights"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Weights
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Questionnaire Questions</CardTitle>
                <CardDescription>Manage risk assessment questions and options</CardDescription>
              </div>
              <Button data-testid="button-add-question">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              {loadingQuestions ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : questions && questions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Options</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((question) => (
                      <TableRow key={question.id}>
                        <TableCell className="font-mono text-sm">{question.questionCode}</TableCell>
                        <TableCell className="max-w-xs truncate">{question.questionText}</TableCell>
                        <TableCell>{question.categoryId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{question.questionType}</Badge>
                        </TableCell>
                        <TableCell>{question.options?.length || 0}</TableCell>
                        <TableCell>
                          <Badge variant={question.isActive ? "default" : "secondary"}>
                            {question.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditingQuestion(question)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Questions Found</AlertTitle>
                  <AlertDescription>
                    Click "Initialize Defaults" to create the standard SEBI questionnaire.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Product Suitability Matrix</CardTitle>
                <CardDescription>Configure which risk profiles can access each product type</CardDescription>
              </div>
              <Button data-testid="button-add-product">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProducts ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : products && products.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">RP1</TableHead>
                      <TableHead className="text-center">RP2</TableHead>
                      <TableHead className="text-center">RP3</TableHead>
                      <TableHead className="text-center">RP4</TableHead>
                      <TableHead className="text-center">RP5</TableHead>
                      <TableHead>Requirements</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.productTypeLabel}</TableCell>
                        <TableCell className="text-center">
                          {product.allowedRP1 ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.allowedRP2 ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.allowedRP3 ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.allowedRP4 ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {product.allowedRP5 ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {product.requiresAccreditedInvestor && <Badge variant="secondary" className="text-xs">Accredited</Badge>}
                            {product.requiresEnhancedKyc && <Badge variant="secondary" className="text-xs">Enhanced KYC</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setEditingProduct(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No Products Configured</AlertTitle>
                  <AlertDescription>
                    Click "Initialize Defaults" to create the standard product eligibility matrix.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEBI Mandatory Override Rules</CardTitle>
              <CardDescription>
                These rules are automatically applied during risk assessment per SEBI guidelines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">Regulatory Override Rules</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  These rules cannot be disabled as they are mandated by SEBI regulations.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Age + Horizon Override</h4>
                      <p className="text-sm text-muted-foreground">
                        Age &gt; 60 AND Investment Horizon &lt; 3 years → Force RP1 (Conservative)
                      </p>
                    </div>
                    <Badge>Mandatory</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Emergency Fund Override</h4>
                      <p className="text-sm text-muted-foreground">
                        No emergency fund → Maximum RP3 (Moderate)
                      </p>
                    </div>
                    <Badge>Mandatory</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">High Liability Override</h4>
                      <p className="text-sm text-muted-foreground">
                        Liabilities &gt; 50% of income → Maximum RP2 (Moderately Conservative)
                      </p>
                    </div>
                    <Badge>Mandatory</Badge>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Low Risk Tolerance Override</h4>
                      <p className="text-sm text-muted-foreground">
                        Cannot tolerate any loss → Maximum RP2 (Moderately Conservative)
                      </p>
                    </div>
                    <Badge>Mandatory</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product Suitability</DialogTitle>
            <DialogDescription>Configure risk profile eligibility for this product</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div>
                <Label>Product Name</Label>
                <Input value={editingProduct.productTypeLabel} disabled />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {["RP1", "RP2", "RP3", "RP4", "RP5"].map((rp) => (
                  <div key={rp} className="flex flex-col items-center gap-2">
                    <Label className="text-xs">{rp}</Label>
                    <Switch
                      checked={editingProduct[`allowed${rp}` as keyof ProductSuitability] as boolean}
                      onCheckedChange={(checked) => {
                        setEditingProduct({
                          ...editingProduct,
                          [`allowed${rp}`]: checked,
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct.requiresAccreditedInvestor}
                    onCheckedChange={(checked) => {
                      setEditingProduct({ ...editingProduct, requiresAccreditedInvestor: checked });
                    }}
                  />
                  <Label className="text-sm">Requires Accredited Investor</Label>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct.requiresEnhancedKyc}
                    onCheckedChange={(checked) => {
                      setEditingProduct({ ...editingProduct, requiresEnhancedKyc: checked });
                    }}
                  />
                  <Label className="text-sm">Requires Enhanced KYC</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
            <Button onClick={() => saveProductMutation.mutate(editingProduct!)} disabled={saveProductMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
