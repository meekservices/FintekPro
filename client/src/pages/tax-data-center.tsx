import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Database, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Building2,
  FileText,
  TrendingUp,
  Receipt,
  Banknote,
  Calendar,
  FileSpreadsheet
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Data source configurations
const DATA_SOURCES = {
  form26as: {
    name: "Form 26AS",
    description: "TDS deducted by employers, banks, and other deductors",
    icon: FileText,
    status: "available"
  },
  ais: {
    name: "Annual Information Statement (AIS)",
    description: "Income details from all sources including salary, interest, dividends",
    icon: Receipt,
    status: "available"
  },
  cams: {
    name: "CAMS (Mutual Funds)",
    description: "Mutual fund transactions and capital gains",
    icon: TrendingUp,
    status: "available"
  },
  kfintech: {
    name: "KFintech (Mutual Funds)",
    description: "Alternative mutual fund registrar data",
    icon: Building2,
    status: "available"
  },
  nsdl: {
    name: "NSDL (Securities)",
    description: "Stock trading and dividend income from NSDL demat",
    icon: Database,
    status: "available"
  },
  cdsl: {
    name: "CDSL (Securities)",
    description: "Stock trading and dividend income from CDSL demat",
    icon: Database,
    status: "available"
  },
  banks: {
    name: "Bank Statements",
    description: "Interest income from savings accounts and FDs",
    icon: Banknote,
    status: "available"
  }
};

interface DataSource {
  id: string;
  name: string;
  status: 'connected' | 'pending' | 'error' | 'not_connected';
  lastSync?: string;
  recordCount?: number;
  dataTypes: string[];
}

interface TaxDataSummary {
  totalIncome: number;
  totalTDS: number;
  capitalGains: number;
  dividendIncome: number;
  interestIncome: number;
  salaryIncome: number;
}

export default function TaxDataCenter() {
  const [selectedYear, setSelectedYear] = useState("2024-25");
  const [panNumber, setPanNumber] = useState("");
  
  // Query for data sources status
  const { data: dataSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['/api/tax-data/sources', selectedYear],
    enabled: !!panNumber
  });

  // Query for aggregated tax summary
  const { data: taxSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/tax-data/summary', selectedYear],
    enabled: !!panNumber
  });

  // Mutation for syncing data from sources
  const syncDataMutation = useMutation({
    mutationFn: (sourceId: string) => 
      apiRequest('POST', `/api/tax-data/sync/${sourceId}`, { 
        body: { year: selectedYear, pan: panNumber } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-data'] });
    }
  });

  // Mutation for generating consolidated report
  const generateReportMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'excel' | 'json') => {
      const response = await apiRequest('POST', '/api/tax-data/generate-report', { 
        body: { year: selectedYear, format, pan: panNumber } 
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      // Download file
      const link = document.createElement('a');
      link.href = data?.downloadUrl || '#';
      link.download = data?.filename || 'tax-report';
      link.click();
    }
  });

  const handleSyncAll = async () => {
    const sources = Object.keys(DATA_SOURCES);
    for (const sourceId of sources) {
      await syncDataMutation.mutateAsync(sourceId);
    }
  };

  const completionPercentage = dataSources && Array.isArray(dataSources) ? 
    (dataSources.filter((s: DataSource) => s.status === 'connected').length / dataSources.length) * 100 
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="tax-data-center">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tax Data Center</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Aggregate all your tax data from multiple sources in one place
          </p>
        </div>
        <div className="flex items-center gap-4 mt-4 lg:mt-0">
          <div className="flex items-center gap-2">
            <Label htmlFor="year-select">Financial Year:</Label>
            <select 
              id="year-select"
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border rounded-md"
              data-testid="select-year"
            >
              <option value="2024-25">2024-25</option>
              <option value="2023-24">2023-24</option>
              <option value="2022-23">2022-23</option>
            </select>
          </div>
        </div>
      </div>

      {/* PAN Input */}
      {!panNumber && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-4">
              <span>Enter your PAN to start aggregating tax data</span>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-32"
                  data-testid="input-pan"
                />
                <Button 
                  onClick={() => {/* Validate PAN */}}
                  disabled={panNumber.length !== 10}
                  data-testid="button-validate-pan"
                >
                  Start
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {panNumber && (
        <>
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Aggregation Progress
              </CardTitle>
              <CardDescription>
                Connect and sync data from all your financial sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Completion</span>
                  <span className="text-sm text-gray-600">{Math.round(completionPercentage)}%</span>
                </div>
                <Progress value={completionPercentage} className="w-full" />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSyncAll}
                    disabled={syncDataMutation.isPending}
                    data-testid="button-sync-all"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncDataMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync All Sources
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => generateReportMutation.mutate('pdf')}
                    disabled={completionPercentage < 50}
                    data-testid="button-generate-report"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Summary */}
          {taxSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Tax Summary for {selectedYear}</CardTitle>
                <CardDescription>Consolidated view of all your income sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">₹{((taxSummary as any)?.totalIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">₹{((taxSummary as any)?.totalTDS || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total TDS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">₹{((taxSummary as any)?.salaryIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Salary Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">₹{((taxSummary as any)?.capitalGains || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Capital Gains</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">₹{((taxSummary as any)?.dividendIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Dividend Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">₹{((taxSummary as any)?.interestIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Interest Income</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Sources */}
          <Tabs defaultValue="sources" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
              <TabsTrigger value="reports">Generated Reports</TabsTrigger>
              <TabsTrigger value="export">Export Options</TabsTrigger>
            </TabsList>

            <TabsContent value="sources" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(DATA_SOURCES).map(([id, source]) => {
                  const sourceData = Array.isArray(dataSources) ? dataSources.find((s: DataSource) => s.id === id) : undefined;
                  const IconComponent = source.icon;
                  
                  return (
                    <Card key={id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                          <Badge variant={
                            sourceData?.status === 'connected' ? 'default' :
                            sourceData?.status === 'pending' ? 'secondary' :
                            sourceData?.status === 'error' ? 'destructive' : 'outline'
                          }>
                            {sourceData?.status === 'connected' ? 'Connected' :
                             sourceData?.status === 'pending' ? 'Syncing' :
                             sourceData?.status === 'error' ? 'Error' : 'Not Connected'}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{source.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {source.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {sourceData?.status === 'connected' && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Records:</span>
                                <span className="font-medium">{sourceData.recordCount || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Last Sync:</span>
                                <span className="text-gray-600">{sourceData.lastSync || 'Never'}</span>
                              </div>
                            </div>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => syncDataMutation.mutate(id)}
                            disabled={syncDataMutation.isPending}
                            data-testid={`button-sync-${id}`}
                          >
                            {syncDataMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : sourceData?.status === 'connected' ? (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            {sourceData?.status === 'connected' ? 'Re-sync' : 'Connect'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Comprehensive Tax Report</CardTitle>
                    <CardDescription>Complete income summary from all sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => generateReportMutation.mutate('pdf')}
                          data-testid="button-download-pdf"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => generateReportMutation.mutate('excel')}
                          data-testid="button-download-excel"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Excel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Source-wise Breakdown</CardTitle>
                    <CardDescription>Detailed reports by data source</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Button size="sm" variant="outline" className="w-full" data-testid="button-form26as-report">
                        Form 26AS Report
                      </Button>
                      <Button size="sm" variant="outline" className="w-full" data-testid="button-ais-report">
                        AIS Report
                      </Button>
                      <Button size="sm" variant="outline" className="w-full" data-testid="button-capital-gains-report">
                        Capital Gains Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Export for External ITR Filing</CardTitle>
                    <CardDescription>Download data in formats compatible with popular ITR platforms</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button className="w-full" data-testid="button-export-cleartax">
                        Export for ClearTax
                      </Button>
                      <Button variant="outline" className="w-full" data-testid="button-export-incometax">
                        Export for Income Tax Portal
                      </Button>
                      <Button variant="outline" className="w-full" data-testid="button-export-ca">
                        Export for CA/Tax Professional
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Raw Data Export</CardTitle>
                    <CardDescription>Download complete datasets for custom processing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => generateReportMutation.mutate('json')}
                        data-testid="button-export-json"
                      >
                        JSON Format
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => generateReportMutation.mutate('excel')}
                        data-testid="button-export-csv"
                      >
                        CSV/Excel Format
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}