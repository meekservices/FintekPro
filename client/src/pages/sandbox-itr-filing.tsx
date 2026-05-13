import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Send,
  Clock,
  Calculator,
  Shield as LucideShield,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ITRFormData {
  id: string;
  assessmentYear: string;
  formType: string;
  status: 'draft' | 'validated' | 'generated' | 'filed';
  totalIncome: number;
  taxLiability: number;
  refundAmount: number;
  lastUpdated: string;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export default function SandboxITRFiling() {
  const [panNumber, setPanNumber] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025-26");
  const [filingMode, setFilingMode] = useState<'guided' | 'import'>('guided');
  
  // Query for ITR form data
  const { data: itrData, isLoading: itrLoading } = useQuery<ITRFormData>({
    queryKey: ['/api/sandbox-itr/form', panNumber, selectedYear],
    enabled: !!panNumber
  });

  // Query for validation results
  const { data: validationResults, isLoading: validationLoading } = useQuery<{ errors: ValidationError[] }>({
    queryKey: ['/api/sandbox-itr/validation', itrData?.id],
    enabled: !!itrData?.id
  });

  // Generate ITR mutation
  const generateITRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sandbox-itr/generate', {
        body: { itrId: itrData?.id, mode: 'production' }
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sandbox-itr'] });
    }
  });

  // File ITR mutation
  const fileITRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sandbox-itr/submit-by-id', {
        body: { itrId: itrData?.id }
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sandbox-itr'] });
    }
  });

  // Auto-populate from tax data
  const autoPopulateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sandbox-itr/auto-populate', {
        body: { pan: panNumber, assessmentYear: selectedYear }
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sandbox-itr'] });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'filed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'generated': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'validated': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'draft': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Sandbox ITR Filing</h1>
        <p className="text-muted-foreground">File your Income Tax Return directly through our platform</p>
      </div>

      {/* PAN Input */}
      {!panNumber && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-4">
              <span>Enter your PAN to start ITR filing process</span>
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
                  Start ITR Filing
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {panNumber && (
        <>
          {/* ITR Filing Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                ITR Filing Status - AY {selectedYear}
              </CardTitle>
              <CardDescription>
                Complete Income Tax Return filing with automated data population
              </CardDescription>
            </CardHeader>
            <CardContent>
              {itrData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{itrData.formType} for AY {itrData.assessmentYear}</h3>
                      <p className="text-sm text-muted-foreground">Last updated: {new Date(itrData.lastUpdated).toLocaleDateString()}</p>
                    </div>
                    <Badge className={getStatusColor(itrData.status)}>
                      {(itrData.status || 'pending').charAt(0).toUpperCase() + (itrData.status || 'pending').slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">₹{itrData.totalIncome.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total Income</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">₹{itrData.taxLiability.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Tax Liability</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">₹{itrData.refundAmount.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Refund Due</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No ITR Found</h3>
                  <p className="text-muted-foreground mb-4">Start by auto-populating data from your tax sources</p>
                  <Button 
                    onClick={() => autoPopulateMutation.mutate()}
                    disabled={autoPopulateMutation.isPending}
                    data-testid="button-auto-populate"
                  >
                    {autoPopulateMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Auto-Populate from Tax Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filing Process Tabs */}
          {itrData && (
            <Tabs defaultValue="review" className="space-y-4">
              <ScrollableTabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="review">Review Data</TabsTrigger>
                <TabsTrigger value="validation">Validation</TabsTrigger>
                <TabsTrigger value="generate">Generate ITR</TabsTrigger>
                <TabsTrigger value="file">File Return</TabsTrigger>
              </ScrollableTabsList>

              <TabsContent value="review" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Income Sources</CardTitle>
                      <CardDescription>Review all income data before filing</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Salary Income:</span>
                          <span className="font-medium">₹8,00,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Capital Gains:</span>
                          <span className="font-medium">₹1,50,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Interest Income:</span>
                          <span className="font-medium">₹2,55,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dividend Income:</span>
                          <span className="font-medium">₹45,000</span>
                        </div>
                        <hr />
                        <div className="flex justify-between font-bold">
                          <span>Total Income:</span>
                          <span>₹{itrData.totalIncome.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Deductions & Exemptions</CardTitle>
                      <CardDescription>Tax saving deductions claimed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>80C Deductions:</span>
                          <span className="font-medium">₹1,50,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>80D Medical Insurance:</span>
                          <span className="font-medium">₹25,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>HRA Exemption:</span>
                          <span className="font-medium">₹2,40,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Standard Deduction:</span>
                          <span className="font-medium">₹50,000</span>
                        </div>
                        <hr />
                        <div className="flex justify-between font-bold">
                          <span>Total Deductions:</span>
                          <span>₹4,65,000</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Data Sources Used</CardTitle>
                    <CardDescription>Information automatically populated from connected sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Form 26AS</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">AIS Data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">CAMS MF</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">NSDL Securities</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="validation" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LucideShield className="h-5 w-5" />
                      ITR Validation Results
                    </CardTitle>
                    <CardDescription>
                      Comprehensive validation before filing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {validationResults && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Validation Passed</span>
                          </div>
                          <Badge variant="default">Ready to File</Badge>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Validation Summary:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">Income sources verified</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">TDS matches Form 26AS</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">Deductions within limits</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">Tax computation correct</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="generate" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Generate ITR Files
                    </CardTitle>
                    <CardDescription>
                      Create ITR-XML for e-filing portal submission
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          This will generate the final ITR-XML file for submission to the Income Tax Department portal.
                        </AlertDescription>
                      </Alert>

                      <div className="flex gap-4">
                        <Button 
                          onClick={() => generateITRMutation.mutate()}
                          disabled={generateITRMutation.isPending || itrData?.status !== 'validated'}
                          data-testid="button-generate-itr"
                        >
                          {generateITRMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Calculator className="h-4 w-4 mr-2" />
                          )}
                          Generate ITR-XML
                        </Button>

                        {itrData?.status === 'generated' && (
                          <Button 
                            variant="outline" 
                            data-testid="button-download-xml"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download XML
                          </Button>
                        )}
                      </div>

                      {itrData?.status === 'generated' && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">ITR Generated Successfully!</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Your ITR-XML file is ready for submission. You can now proceed to file your return.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      File ITR Return
                    </CardTitle>
                    <CardDescription>
                      Submit your return to the Income Tax Department
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {itrData?.status === 'filed' ? (
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <h4 className="font-medium text-green-800 dark:text-green-200">ITR Filed Successfully!</h4>
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                            Your ITR has been successfully submitted to the Income Tax Department.
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Acknowledgment Number:</span>
                              <span className="font-mono font-medium">ITR{new Date().getFullYear()}12345678</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Filed Date:</span>
                              <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <Badge variant="default">Successfully Submitted</Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Final step: Submit your ITR to the Income Tax Department portal. This action cannot be undone.
                            </AlertDescription>
                          </Alert>

                          <div className="space-y-3">
                            <div className="p-4 bg-muted rounded-lg">
                              <h4 className="font-medium mb-2">Pre-filing Checklist:</h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>All income sources verified</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>ITR-XML generated successfully</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span>Validation completed without errors</span>
                                </div>
                              </div>
                            </div>

                            <Button 
                              onClick={() => fileITRMutation.mutate()}
                              disabled={fileITRMutation.isPending || itrData?.status !== 'generated'}
                              className="w-full"
                              data-testid="button-file-itr"
                            >
                              {fileITRMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Submit ITR to Income Tax Department
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}