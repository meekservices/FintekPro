import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Search, Save, Play, TrendingUp, TrendingDown, Percent, IndianRupee, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ScreenerType = "mutual_fund" | "stock" | "bond" | "etf";

interface ScreenerCriteria {
  field: string;
  operator: string;
  value: string;
}

type SortDirection = "asc" | "desc" | null;
interface SortConfig {
  key: string;
  direction: SortDirection;
}

export default function AgentScreener() {
  const { toast } = useToast();
  const [screenerType, setScreenerType] = useState<ScreenerType>("mutual_fund");
  const [criteria, setCriteria] = useState<ScreenerCriteria[]>([
    { field: "", operator: ">=", value: "" }
  ]);
  const [screenerName, setScreenerName] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });

  const mfFields = [
    { value: "returns_1y", label: "1Y Returns (%)" },
    { value: "returns_3y", label: "3Y Returns (%)" },
    { value: "returns_5y", label: "5Y Returns (%)" },
    { value: "expense_ratio", label: "Expense Ratio (%)" },
    { value: "aum", label: "AUM (Cr)" },
    { value: "nav", label: "NAV" },
  ];

  const stockFields = [
    { value: "market_cap", label: "Market Cap (Cr)" },
    { value: "pe_ratio", label: "P/E Ratio" },
    { value: "pb_ratio", label: "P/B Ratio" },
    { value: "dividend_yield", label: "Dividend Yield (%)" },
    { value: "roe", label: "ROE (%)" },
    { value: "debt_equity", label: "Debt/Equity" },
  ];

  const operators = [
    { value: ">=", label: ">=" },
    { value: "<=", label: "<=" },
    { value: ">", label: ">" },
    { value: "<", label: "<" },
    { value: "=", label: "=" },
  ];

  const fields = screenerType === "mutual_fund" ? mfFields : stockFields;

  const addCriteria = () => {
    setCriteria([...criteria, { field: "", operator: ">=", value: "" }]);
  };

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriteria = (index: number, key: keyof ScreenerCriteria, value: string) => {
    const updated = [...criteria];
    updated[index][key] = value;
    setCriteria(updated);
  };

  const runScreenerMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, Record<string, number>> = {};
      criteria.forEach(c => {
        if (c.field && c.value) {
          filters[c.field] = { [c.operator]: parseFloat(c.value) };
        }
      });
      const universe = screenerType === "mutual_fund" ? "MF" : screenerType === "stock" ? "STOCK" : screenerType.toUpperCase();
      return apiRequest("/api/research-lists/screener/run", {
        method: "POST",
        body: JSON.stringify({
          universe,
          filters,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Screener executed",
        description: `Found ${data.results?.length || 0} matching instruments`,
      });
    },
    onError: () => {
      toast({
        title: "Screener failed",
        description: "Could not execute screener",
        variant: "destructive",
      });
    },
  });

  const saveScreenerMutation = useMutation({
    mutationFn: async () => {
      const dslCriteria: Record<string, Record<string, number>> = {};
      criteria.forEach(c => {
        if (c.field && c.value) {
          dslCriteria[c.field] = { [c.operator]: parseFloat(c.value) };
        }
      });
      return apiRequest("/api/research-lists/screeners", {
        method: "POST",
        body: JSON.stringify({
          name: screenerName,
          screenerType,
          criteria: dslCriteria,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Screener saved",
        description: "Your screener has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/research-lists/screeners"] });
    },
  });

  const { data: savedScreeners } = useQuery({
    queryKey: ["/api/research-lists/screeners"],
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedResults = useMemo(() => {
    const results = runScreenerMutation.data?.results || [];
    if (!sortConfig.key || !sortConfig.direction) return results;
    
    return [...results].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      const aNull = aVal === null || aVal === undefined || aVal === "";
      const bNull = bVal === null || bVal === undefined || bVal === "";
      
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [runScreenerMutation.data?.results, sortConfig]);

  const SortableHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: string; align?: "left" | "right" | "center" }) => {
    const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
    const justifyClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";
    return (
      <th 
        className={`${alignClass} py-3 px-3 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-700 select-none transition-colors`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1 ${justifyClass}`}>
          {label}
          {sortConfig.key === sortKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </div>
      </th>
    );
  };

  return (
    <AgentLayout title="Instrument Screener" description="Filter and find instruments matching your criteria">
      <div className="space-y-6">
        <Tabs defaultValue="builder" className="w-full">
          <TabsList>
            <TabsTrigger value="builder">Screener Builder</TabsTrigger>
            <TabsTrigger value="saved">Saved Screeners</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Build Your Screener
                </CardTitle>
                <CardDescription>
                  Define criteria to filter instruments based on financial metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Instrument Type</Label>
                    <Select value={screenerType} onValueChange={(v) => setScreenerType(v as ScreenerType)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
                        <SelectItem value="stock">Stocks</SelectItem>
                        <SelectItem value="etf">ETFs</SelectItem>
                        <SelectItem value="bond">Bonds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>Screener Name (for saving)</Label>
                    <Input
                      placeholder="e.g., High Return Low Cost MFs"
                      value={screenerName}
                      onChange={(e) => setScreenerName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Filter Criteria</Label>
                  {criteria.map((c, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select value={c.field} onValueChange={(v) => updateCriteria(index, "field", v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={c.operator} onValueChange={(v) => updateCriteria(index, "operator", v)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Value"
                        className="w-32"
                        value={c.value}
                        onChange={(e) => updateCriteria(index, "value", e.target.value)}
                      />
                      {criteria.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeCriteria(index)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addCriteria}>
                    + Add Criteria
                  </Button>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => runScreenerMutation.mutate()} disabled={runScreenerMutation.isPending}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Screener
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => saveScreenerMutation.mutate()}
                    disabled={!screenerName || saveScreenerMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Screener
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Screener Results</CardTitle>
                <CardDescription>
                  {runScreenerMutation.data?.results 
                    ? `${runScreenerMutation.data.results.length} instruments match your criteria`
                    : "Results will appear here after running the screener"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runScreenerMutation.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Running screener...
                  </div>
                ) : runScreenerMutation.data?.results?.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                      <table className="w-full text-sm min-w-[1800px]">
                        <thead className="bg-slate-800 dark:bg-slate-900 text-white sticky top-0 z-10">
                          <tr>
                            <SortableHeader label="Name" sortKey="name" />
                            <SortableHeader label="Symbol" sortKey="symbol" />
                            <SortableHeader label="ISIN" sortKey="isin" />
                            {screenerType === "mutual_fund" ? (
                              <>
                                <SortableHeader label="Category" sortKey="category" />
                                <SortableHeader label="Fund House" sortKey="fundHouse" />
                                <SortableHeader label="NAV" sortKey="nav" align="right" />
                                <SortableHeader label="1Y Return" sortKey="returns1y" align="right" />
                                <SortableHeader label="3Y Return" sortKey="returns3y" align="right" />
                                <SortableHeader label="5Y Return" sortKey="returns5y" align="right" />
                                <SortableHeader label="Expense %" sortKey="expenseRatio" align="right" />
                                <SortableHeader label="AUM (Cr)" sortKey="aum" align="right" />
                                <SortableHeader label="Risk" sortKey="riskLevel" align="center" />
                                <SortableHeader label="Rating" sortKey="rating" align="center" />
                              </>
                            ) : (
                              <>
                                <SortableHeader label="Sector" sortKey="sector" />
                                <SortableHeader label="Industry" sortKey="industry" />
                                <SortableHeader label="Price" sortKey="currentPrice" align="right" />
                                <SortableHeader label="Change %" sortKey="dayChangePercent" align="right" />
                                <SortableHeader label="52W High" sortKey="weekHigh52" align="right" />
                                <SortableHeader label="52W Low" sortKey="weekLow52" align="right" />
                                <SortableHeader label="Mkt Cap (Cr)" sortKey="marketCapValue" align="right" />
                                <SortableHeader label="Cap Type" sortKey="marketCap" align="center" />
                                <SortableHeader label="P/E" sortKey="peRatio" align="right" />
                                <SortableHeader label="P/B" sortKey="pbRatio" align="right" />
                                <SortableHeader label="Div Yield %" sortKey="dividendYield" align="right" />
                                <SortableHeader label="ROE %" sortKey="roe" align="right" />
                                <SortableHeader label="D/E" sortKey="debtEquity" align="right" />
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedResults.map((item: any) => (
                            <tr key={item.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-3">
                                <div className="font-medium max-w-[220px] truncate" title={item.name}>
                                  {item.name}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <Badge variant="outline" className="font-mono text-xs">{item.symbol}</Badge>
                              </td>
                              <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                                {item.isin || "-"}
                              </td>
                              {screenerType === "mutual_fund" ? (
                                <>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.category}>
                                    {item.category || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.fundHouse}>
                                    {item.fundHouse || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    ₹{parseFloat(item.nav || 0).toFixed(2)}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns1y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns1y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns1y || 0).toFixed(2)}%
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns3y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns3y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns3y || 0).toFixed(2)}%
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns5y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns5y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns5y || 0).toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.expenseRatio ? `${parseFloat(item.expenseRatio).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.aum ? `₹${parseFloat(item.aum).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant={item.riskLevel === "Low" ? "default" : item.riskLevel === "Moderate" ? "secondary" : "destructive"} className="text-xs">
                                      {item.riskLevel || "-"}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant="outline" className="text-xs">{item.rating || "-"}</Badge>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.sector}>
                                    {item.sector || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.industry}>
                                    {item.industry || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    ₹{parseFloat(item.currentPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.dayChangePercent || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.dayChangePercent || 0) >= 0 ? "+" : ""}{parseFloat(item.dayChangePercent || 0).toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-green-600">
                                    {item.weekHigh52 ? `₹${parseFloat(item.weekHigh52).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-red-600">
                                    {item.weekLow52 ? `₹${parseFloat(item.weekLow52).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.marketCapValue ? `₹${parseFloat(item.marketCapValue).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant="secondary" className="text-xs">{item.marketCap || "-"}</Badge>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.peRatio ? parseFloat(item.peRatio).toFixed(2) : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.pbRatio ? parseFloat(item.pbRatio).toFixed(2) : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-blue-600">
                                    {item.dividendYield ? `${parseFloat(item.dividendYield).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.roe || 0) >= 15 ? "text-green-600" : ""}`}>
                                    {item.roe ? `${parseFloat(item.roe).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.debtEquity || 0) > 1 ? "text-red-600" : ""}`}>
                                    {item.debtEquity ? parseFloat(item.debtEquity).toFixed(2) : "-"}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {runScreenerMutation.data?.results?.length === 0 
                      ? "No instruments match your criteria. Try adjusting your filters."
                      : "Click 'Run Screener' to search for matching instruments"
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Saved Screeners</CardTitle>
                <CardDescription>
                  Your saved screeners for quick access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(savedScreeners as any)?.screeners?.length > 0 ? (
                  <div className="space-y-2">
                    {(savedScreeners as any).screeners.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {s.screenerType} • {s.runCount || 0} runs
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4 mr-1" />
                          Run
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No saved screeners yet. Create and save a screener to see it here.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">12%+</div>
                  <div className="text-sm text-muted-foreground">Popular: 3Y Returns</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Percent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">&lt;1%</div>
                  <div className="text-sm text-muted-foreground">Popular: Expense Ratio</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <IndianRupee className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">₹1000 Cr+</div>
                  <div className="text-sm text-muted-foreground">Popular: Min AUM</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
}
