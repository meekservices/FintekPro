import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Loader2, TrendingUp, CheckCircle, 
  AlertCircle, Sprout, Package, BarChart3, Building2,
  RefreshCw, Plus, Eye, EyeOff
} from "lucide-react";
import { Link } from "wouter";

interface ListedStock {
  id: string;
  symbol: string;
  companyName: string;
  isin?: string;
  bseCode?: string;
  nseCode?: string;
  sector?: string;
  industry?: string;
  marketCap?: string;
  currentPrice?: string;
  peRatio?: string;
  pbRatio?: string;
  dividendYield?: string;
  returns1Y?: string;
  returns3Y?: string;
  analystRating?: string;
  targetPrice?: string;
  isPublished: boolean;
  selectionNotes?: string;
}

const SECTORS = [
  'Information Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Goods',
  'Automobile',
  'Energy',
  'Metals & Mining',
  'Pharmaceuticals',
  'Telecommunications',
  'Real Estate',
  'Utilities',
  'Infrastructure',
  'FMCG',
  'Banking',
  'Insurance'
];

const MARKET_CAPS = ['Large Cap', 'Mid Cap', 'Small Cap', 'Micro Cap'];

export default function ListedStocksSeed() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [marketCapFilter, setMarketCapFilter] = useState<string>("all");
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStock, setNewStock] = useState({
    symbol: "",
    companyName: "",
    isin: "",
    bseCode: "",
    nseCode: "",
    sector: "",
    industry: "",
    marketCap: "",
    currentPrice: "",
    peRatio: "",
    pbRatio: "",
    dividendYield: "",
    return1Year: "",
    return3Year: "",
    analystRating: "",
    targetPrice: "",
    selectionNotes: ""
  });

  const { data: stocks, isLoading, refetch } = useQuery<ListedStock[]>({
    queryKey: ['/api/admin/listed-stocks'],
  });

  const addStockMutation = useMutation({
    mutationFn: async (stock: typeof newStock) => {
      return await apiRequest('/api/admin/listed-stocks', {
        method: 'POST',
        body: JSON.stringify(stock),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stock added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/listed-stocks'] });
      setShowAddForm(false);
      setNewStock({
        symbol: "", companyName: "", isin: "", bseCode: "", nseCode: "",
        sector: "", industry: "", marketCap: "", currentPrice: "",
        peRatio: "", pbRatio: "", dividendYield: "", return1Year: "",
        return3Year: "", analystRating: "", targetPrice: "", selectionNotes: ""
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add stock", variant: "destructive" });
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return await apiRequest(`/api/admin/listed-stocks/${id}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stock updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/listed-stocks'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stock", variant: "destructive" });
    }
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async ({ ids, isPublished }: { ids: string[]; isPublished: boolean }) => {
      return await apiRequest('/api/admin/listed-stocks/bulk-publish', {
        method: 'PATCH',
        body: JSON.stringify({ ids, isPublished }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stocks updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/listed-stocks'] });
      setSelectedStocks(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stocks", variant: "destructive" });
    }
  });

  const filteredStocks = (stocks || []).filter(stock => {
    const matchesSearch = !searchQuery || 
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.sector?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = sectorFilter === "all" || stock.sector === sectorFilter;
    const matchesMarketCap = marketCapFilter === "all" || stock.marketCap === marketCapFilter;
    return matchesSearch && matchesSector && matchesMarketCap;
  });

  const publishedCount = (stocks || []).filter(s => s.isPublished).length;
  const totalCount = (stocks || []).length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStocks(new Set(filteredStocks.map(s => s.id)));
    } else {
      setSelectedStocks(new Set());
    }
  };

  const handleSelectStock = (id: string, checked: boolean) => {
    const newSet = new Set(selectedStocks);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedStocks(newSet);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/store">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Store
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              Listed Stocks Seed Management
            </h1>
            <p className="text-gray-400">Manage listed stocks for AI investment recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold">{totalCount}</p>
                  <p className="text-sm text-gray-400">Total Stocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold">{publishedCount}</p>
                  <p className="text-sm text-gray-400">Published</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold">{totalCount - publishedCount}</p>
                  <p className="text-sm text-gray-400">Unpublished</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold">{selectedStocks.size}</p>
                  <p className="text-sm text-gray-400">Selected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-emerald-400" />
                  Listed Stocks Inventory
                </CardTitle>
                <CardDescription>
                  Add and manage stocks for AI-powered investment proposals
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                  className="border-gray-600"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={() => setShowAddForm(!showAddForm)}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-add-stock"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stock
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddForm && (
              <Card className="bg-gray-900/50 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-lg">Add New Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Symbol *</Label>
                      <Input
                        value={newStock.symbol}
                        onChange={(e) => setNewStock({ ...newStock, symbol: e.target.value.toUpperCase() })}
                        placeholder="RELIANCE"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-symbol"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Company Name *</Label>
                      <Input
                        value={newStock.companyName}
                        onChange={(e) => setNewStock({ ...newStock, companyName: e.target.value })}
                        placeholder="Reliance Industries Limited"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div>
                      <Label>ISIN</Label>
                      <Input
                        value={newStock.isin}
                        onChange={(e) => setNewStock({ ...newStock, isin: e.target.value.toUpperCase() })}
                        placeholder="INE002A01018"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-isin"
                      />
                    </div>
                    <div>
                      <Label>BSE Code</Label>
                      <Input
                        value={newStock.bseCode}
                        onChange={(e) => setNewStock({ ...newStock, bseCode: e.target.value })}
                        placeholder="500325"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-bse-code"
                      />
                    </div>
                    <div>
                      <Label>NSE Code</Label>
                      <Input
                        value={newStock.nseCode}
                        onChange={(e) => setNewStock({ ...newStock, nseCode: e.target.value.toUpperCase() })}
                        placeholder="RELIANCE"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-nse-code"
                      />
                    </div>
                    <div>
                      <Label>Sector</Label>
                      <Select value={newStock.sector} onValueChange={(v) => setNewStock({ ...newStock, sector: v })}>
                        <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-sector">
                          <SelectValue placeholder="Select sector" />
                        </SelectTrigger>
                        <SelectContent>
                          {SECTORS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Market Cap</Label>
                      <Select value={newStock.marketCap} onValueChange={(v) => setNewStock({ ...newStock, marketCap: v })}>
                        <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-market-cap">
                          <SelectValue placeholder="Select market cap" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKET_CAPS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Price (₹)</Label>
                      <Input
                        type="number"
                        value={newStock.currentPrice}
                        onChange={(e) => setNewStock({ ...newStock, currentPrice: e.target.value })}
                        placeholder="1500.00"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-current-price"
                      />
                    </div>
                    <div>
                      <Label>P/E Ratio</Label>
                      <Input
                        type="number"
                        value={newStock.peRatio}
                        onChange={(e) => setNewStock({ ...newStock, peRatio: e.target.value })}
                        placeholder="25.5"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-pe-ratio"
                      />
                    </div>
                    <div>
                      <Label>Dividend Yield (%)</Label>
                      <Input
                        type="number"
                        value={newStock.dividendYield}
                        onChange={(e) => setNewStock({ ...newStock, dividendYield: e.target.value })}
                        placeholder="1.2"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-dividend-yield"
                      />
                    </div>
                    <div>
                      <Label>1Y Return (%)</Label>
                      <Input
                        type="number"
                        value={newStock.return1Year}
                        onChange={(e) => setNewStock({ ...newStock, return1Year: e.target.value })}
                        placeholder="15.5"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-return-1y"
                      />
                    </div>
                    <div>
                      <Label>Analyst Rating</Label>
                      <Select value={newStock.analystRating} onValueChange={(v) => setNewStock({ ...newStock, analystRating: v })}>
                        <SelectTrigger className="bg-gray-800 border-gray-600" data-testid="select-analyst-rating">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Strong Buy">Strong Buy</SelectItem>
                          <SelectItem value="Buy">Buy</SelectItem>
                          <SelectItem value="Hold">Hold</SelectItem>
                          <SelectItem value="Sell">Sell</SelectItem>
                          <SelectItem value="Strong Sell">Strong Sell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Target Price (₹)</Label>
                      <Input
                        type="number"
                        value={newStock.targetPrice}
                        onChange={(e) => setNewStock({ ...newStock, targetPrice: e.target.value })}
                        placeholder="1800.00"
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-target-price"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Selection Notes</Label>
                      <Input
                        value={newStock.selectionNotes}
                        onChange={(e) => setNewStock({ ...newStock, selectionNotes: e.target.value })}
                        placeholder="Why this stock is recommended..."
                        className="bg-gray-800 border-gray-600"
                        data-testid="input-selection-notes"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => addStockMutation.mutate(newStock)}
                      disabled={!newStock.symbol || !newStock.companyName || addStockMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      data-testid="button-save-stock"
                    >
                      {addStockMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Save Stock
                    </Button>
                    <Button
                      onClick={() => setShowAddForm(false)}
                      variant="outline"
                      className="border-gray-600"
                      data-testid="button-cancel-add"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stocks..."
                  className="pl-10 bg-gray-800 border-gray-600"
                  data-testid="input-search"
                />
              </div>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[180px] bg-gray-800 border-gray-600" data-testid="filter-sector">
                  <SelectValue placeholder="Filter by sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={marketCapFilter} onValueChange={setMarketCapFilter}>
                <SelectTrigger className="w-[150px] bg-gray-800 border-gray-600" data-testid="filter-market-cap">
                  <SelectValue placeholder="Market Cap" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Caps</SelectItem>
                  {MARKET_CAPS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStocks.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => bulkPublishMutation.mutate({ ids: Array.from(selectedStocks), isPublished: true })}
                    disabled={bulkPublishMutation.isPending}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-bulk-publish"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Publish ({selectedStocks.size})
                  </Button>
                  <Button
                    onClick={() => bulkPublishMutation.mutate({ ids: Array.from(selectedStocks), isPublished: false })}
                    disabled={bulkPublishMutation.isPending}
                    size="sm"
                    variant="outline"
                    className="border-gray-600"
                    data-testid="button-bulk-unpublish"
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    Unpublish ({selectedStocks.size})
                  </Button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            ) : filteredStocks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No stocks found. Add your first stock to get started.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedStocks.size === filteredStocks.length && filteredStocks.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Market Cap</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">P/E</TableHead>
                      <TableHead className="text-right">1Y Return</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow key={stock.id} className="border-gray-700 hover:bg-gray-800/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedStocks.has(stock.id)}
                            onCheckedChange={(checked) => handleSelectStock(stock.id, !!checked)}
                            data-testid={`checkbox-stock-${stock.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-blue-400">{stock.symbol}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{stock.companyName}</p>
                            {stock.isin && <p className="text-xs text-gray-400">{stock.isin}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {stock.sector || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              stock.marketCap === 'Large Cap' ? 'bg-blue-500/20 text-blue-400' :
                              stock.marketCap === 'Mid Cap' ? 'bg-purple-500/20 text-purple-400' :
                              stock.marketCap === 'Small Cap' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-gray-500/20 text-gray-400'
                            }
                          >
                            {stock.marketCap || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {stock.currentPrice ? `₹${parseFloat(stock.currentPrice).toLocaleString('en-IN')}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {stock.returns1Y ? (
                            <span className={parseFloat(stock.returns1Y) >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {parseFloat(stock.returns1Y) >= 0 ? '+' : ''}{parseFloat(stock.returns1Y).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {stock.analystRating ? (
                            <Badge 
                              className={
                                stock.analystRating.includes('Buy') ? 'bg-green-500/20 text-green-400' :
                                stock.analystRating === 'Hold' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }
                            >
                              {stock.analystRating}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            className={stock.isPublished 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-gray-500/20 text-gray-400'
                            }
                          >
                            {stock.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePublishMutation.mutate({ id: stock.id, isPublished: !stock.isPublished })}
                            disabled={togglePublishMutation.isPending}
                            className={stock.isPublished ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}
                            data-testid={`button-toggle-${stock.id}`}
                          >
                            {stock.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
