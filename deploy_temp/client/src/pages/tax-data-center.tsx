import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  FileSpreadsheet,
  Upload,
  FileUp,
  Scan,
  Eye,
  Loader2
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

interface OCRParseResult {
  success: boolean;
  documentType: string;
  data: any;
  extractedAt: string;
  confidence?: number;
  message?: string;
}

interface Form16Data {
  pan: string;
  employerName: string;
  employerTan: string;
  assessmentYear: string;
  grossSalary: number;
  totalDeductions: number;
  taxableIncome: number;
  taxDeducted: number;
  surcharge: number;
  educationCess: number;
  totalTax: number;
}

interface Form26ASData {
  pan: string;
  assessmentYear: string;
  totalTDSDeducted: number;
  tdsEntries: Array<{
    deductorName: string;
    deductorTan: string;
    section: string;
    amountCredited: number;
    tdsDeducted: number;
    quarterEnd: string;
  }>;
}

interface OCRStatusResponse {
  success: boolean;
  available: boolean;
  mode: 'live' | 'mock';
  message: string;
}

export default function TaxDataCenter() {
  const [selectedYear, setSelectedYear] = useState("2024-25");
  const [panNumber, setPanNumber] = useState("");
  const [ocrResult, setOcrResult] = useState<OCRParseResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<'form16' | 'form26as' | 'auto'>('auto');
  const { toast } = useToast();
  
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
      apiRequest(`/api/tax-data/sync/${sourceId}`, { 
        method: 'POST',
        body: JSON.stringify({ year: selectedYear, pan: panNumber })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-data'] });
    }
  });

  // Mutation for generating consolidated report
  const generateReportMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'excel' | 'json') => {
      const response = await apiRequest('/api/tax-data/generate-report', { 
        method: 'POST',
        body: JSON.stringify({ year: selectedYear, format, pan: panNumber })
      });
      return response;
    },
    onSuccess: (data: any) => {
      // Download file
      const link = document.createElement('a');
      link.href = data?.downloadUrl || '#';
      link.download = data?.filename || 'tax-report';
      link.click();
    }
  });

  // Query for OCR service status
  const { data: ocrStatus } = useQuery<OCRStatusResponse>({
    queryKey: ['/api/ocr/status']
  });

  // Mutation for OCR document parsing
  const ocrParseMutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: 'form16' | 'form26as' | 'auto' }) => {
      const base64Data = await fileToBase64(file);
      const endpoint = docType === 'form16' ? '/api/ocr/form16' 
                     : docType === 'form26as' ? '/api/ocr/form26as' 
                     : '/api/ocr/parse-document';
      
      const response = await apiRequest(endpoint, { 
        method: 'POST',
        body: JSON.stringify({ 
          fileData: base64Data, 
          fileName: file.name,
          documentType: docType === 'auto' ? undefined : docType
        })
      });
      return response;
    },
    onSuccess: (data: OCRParseResult) => {
      setOcrResult(data);
      if (data.success) {
        toast({
          title: "Document Parsed Successfully",
          description: `Extracted data from ${data.documentType}`,
        });
      } else {
        toast({
          title: "Parsing Issue",
          description: data.message || "Could not fully extract document data",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "OCR Error",
        description: error.message || "Failed to parse document",
        variant: "destructive"
      });
    }
  });

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF document",
          variant: "destructive"
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "File Too Large",
          description: "Maximum file size is 10MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
      setOcrResult(null);
    }
  }, [toast]);

  // Handle OCR parsing
  const handleParseDocument = () => {
    if (selectedFile) {
      ocrParseMutation.mutate({ file: selectedFile, docType: documentType });
    }
  };

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
          <h1 className="text-3xl font-bold text-foreground">Tax Data Center</h1>
          <p className="text-muted-foreground mt-2">
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
                  <span className="text-sm text-muted-foreground">{Math.round(completionPercentage)}%</span>
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
                    <div className="text-sm text-muted-foreground">Total Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">₹{((taxSummary as any)?.totalTDS || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total TDS</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">₹{((taxSummary as any)?.salaryIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Salary Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">₹{((taxSummary as any)?.capitalGains || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Capital Gains</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">₹{((taxSummary as any)?.dividendIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Dividend Income</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">₹{((taxSummary as any)?.interestIncome || 0).toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Interest Income</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Sources */}
          <Tabs defaultValue="sources" className="space-y-4">
            <ScrollableTabsList>
              <TabsTrigger value="sources">Data Sources</TabsTrigger>
              <TabsTrigger value="ocr">OCR Upload</TabsTrigger>
              <TabsTrigger value="reports">Generated Reports</TabsTrigger>
              <TabsTrigger value="export">Export Options</TabsTrigger>
            </ScrollableTabsList>

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
                                <span className="text-muted-foreground">{sourceData.lastSync || 'Never'}</span>
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

            <TabsContent value="ocr" className="space-y-4">
              {/* OCR Service Status */}
              <Alert className={ocrStatus?.available ? 'border-green-500' : 'border-amber-500'}>
                <Scan className="h-4 w-4" />
                <AlertTitle>OCR Document Parser</AlertTitle>
                <AlertDescription>
                  {ocrStatus?.available 
                    ? 'OCR service is connected and ready to parse Form 16 and Form 26AS documents'
                    : 'OCR service is in demo mode. Documents will be parsed with sample data.'}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload Tax Document
                    </CardTitle>
                    <CardDescription>
                      Upload Form 16 or Form 26AS PDF to automatically extract tax data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Document Type Selection */}
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={documentType === 'auto' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDocumentType('auto')}
                          data-testid="button-doctype-auto"
                        >
                          Auto-Detect
                        </Button>
                        <Button
                          variant={documentType === 'form16' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDocumentType('form16')}
                          data-testid="button-doctype-form16"
                        >
                          Form 16
                        </Button>
                        <Button
                          variant={documentType === 'form26as' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setDocumentType('form26as')}
                          data-testid="button-doctype-form26as"
                        >
                          Form 26AS
                        </Button>
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label htmlFor="file-upload">Select PDF Document</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".pdf"
                          onChange={handleFileSelect}
                          className="flex-1"
                          data-testid="input-file-upload"
                        />
                      </div>
                      {selectedFile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{selectedFile.name}</span>
                          <span className="text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      )}
                    </div>

                    {/* Parse Button */}
                    <Button
                      onClick={handleParseDocument}
                      disabled={!selectedFile || ocrParseMutation.isPending}
                      className="w-full"
                      data-testid="button-parse-document"
                    >
                      {ocrParseMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Parsing Document...
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4 mr-2" />
                          Parse Document with OCR
                        </>
                      )}
                    </Button>

                    {/* Supported Documents */}
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Supported Documents:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Form 16 (TDS Certificate from Employer)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Form 26AS (Tax Credit Statement)
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>

                {/* Results Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Extracted Data
                    </CardTitle>
                    <CardDescription>
                      View and verify the data extracted from your document
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!ocrResult && !ocrParseMutation.isPending && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Upload and parse a document to see extracted data here</p>
                      </div>
                    )}

                    {ocrParseMutation.isPending && (
                      <div className="text-center py-8">
                        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-500" />
                        <p className="text-muted-foreground">Analyzing document with OCR...</p>
                      </div>
                    )}

                    {ocrResult && ocrResult.success && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="default" className="bg-green-500">
                            {ocrResult.documentType}
                          </Badge>
                          {ocrResult.confidence && (
                            <span className="text-sm text-muted-foreground">
                              Confidence: {(ocrResult.confidence * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {/* Form 16 Data Display */}
                        {ocrResult.documentType === 'form16' && ocrResult.data && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="text-muted-foreground">PAN:</div>
                              <div className="font-medium">{ocrResult.data.pan || 'N/A'}</div>
                              <div className="text-muted-foreground">Employer:</div>
                              <div className="font-medium">{ocrResult.data.employerName || 'N/A'}</div>
                              <div className="text-muted-foreground">Assessment Year:</div>
                              <div className="font-medium">{ocrResult.data.assessmentYear || 'N/A'}</div>
                            </div>
                            <div className="border-t pt-3 space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Gross Salary:</span>
                                <span className="font-medium text-green-600">₹{(ocrResult.data.grossSalary || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Deductions:</span>
                                <span className="font-medium text-orange-600">₹{(ocrResult.data.totalDeductions || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Taxable Income:</span>
                                <span className="font-medium">₹{(ocrResult.data.taxableIncome || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between border-t pt-2">
                                <span className="text-muted-foreground font-medium">Total TDS:</span>
                                <span className="font-bold text-blue-600">₹{(ocrResult.data.totalTax || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Form 26AS Data Display */}
                        {ocrResult.documentType === 'form26as' && ocrResult.data && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="text-muted-foreground">PAN:</div>
                              <div className="font-medium">{ocrResult.data.pan || 'N/A'}</div>
                              <div className="text-muted-foreground">Assessment Year:</div>
                              <div className="font-medium">{ocrResult.data.assessmentYear || 'N/A'}</div>
                            </div>
                            <div className="border-t pt-3">
                              <div className="flex justify-between mb-3">
                                <span className="text-muted-foreground font-medium">Total TDS Deducted:</span>
                                <span className="font-bold text-blue-600">₹{(ocrResult.data.totalTDSDeducted || 0).toLocaleString()}</span>
                              </div>
                              {ocrResult.data.tdsEntries && ocrResult.data.tdsEntries.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">TDS Entries ({ocrResult.data.tdsEntries.length}):</p>
                                  <div className="max-h-48 overflow-y-auto space-y-2">
                                    {ocrResult.data.tdsEntries.slice(0, 5).map((entry: any, idx: number) => (
                                      <div key={idx} className="bg-muted p-2 rounded text-sm">
                                        <div className="font-medium">{entry.deductorName}</div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>{entry.section}</span>
                                          <span>₹{(entry.tdsDeducted || 0).toLocaleString()}</span>
                                        </div>
                                      </div>
                                    ))}
                                    {ocrResult.data.tdsEntries.length > 5 && (
                                      <p className="text-sm text-muted-foreground text-center">
                                        +{ocrResult.data.tdsEntries.length - 5} more entries
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-4 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOcrResult(null)}
                            data-testid="button-clear-result"
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            data-testid="button-import-data"
                          >
                            Import to Tax Data
                          </Button>
                        </div>
                      </div>
                    )}

                    {ocrResult && !ocrResult.success && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Parsing Failed</AlertTitle>
                        <AlertDescription>
                          {ocrResult.message || 'Could not extract data from the document. Please ensure the PDF is a valid tax document.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
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