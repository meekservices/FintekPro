import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Download, RefreshCw, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CapitalGainsReport {
  id: string;
  clientId: string;
  financialYear: string;
  reportType: string;
  source: string;
  totalShortTermGains: string;
  totalLongTermGains: string;
  totalDividend: string;
  totalTdsDeducted: string;
  reportData: any;
  generatedAt: string;
  fetchedAt?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export function CapitalGainsReportViewer() {
  const { user } = useAuth();
  const [selectedClientId, setSelectedClientId] = useState(user?.id || '');
  const [selectedFY, setSelectedFY] = useState('2023-24');
  const [selectedSource, setSelectedSource] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['/api/capital-gains-reports', selectedClientId, selectedFY],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClientId !== 'all') params.append('userId', selectedClientId);
      if (selectedFY !== 'all') params.append('financialYear', selectedFY);
      
      const response = await fetch(`/api/capital-gains-reports?${params}`);
      if (!response.ok) throw new Error('Failed to fetch reports');
      return response.json();
    }
  });

  const fetchFromMFCentralMutation = useMutation({
    mutationFn: async (params: { clientId: string; financialYear: string; panNumber: string }) => {
      const response = await fetch('/api/reports/fetch-from-mf-central', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch from MF Central');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Capital gains report fetched from MF Central successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/capital-gains-reports'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to fetch from MF Central: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const financialYears = [
    '2023-24', '2022-23', '2021-22', '2020-21', '2019-20'
  ];

  const sources = [
    { value: 'all', label: 'All Sources' },
    { value: 'mf_central', label: 'MF Central' },
    { value: 'nsdl', label: 'NSDL' },
    { value: 'cdsl', label: 'CDSL' },
    { value: 'kfintech', label: 'KFintech' },
    { value: 'cams', label: 'CAMS' }
  ];

  const handleFetchFromMFCentral = () => {
    fetchFromMFCentralMutation.mutate({
      clientId: selectedClientId,
      financialYear: selectedFY,
      panNumber: 'ABCDE1234F' // Mock PAN number
    });
  };

  const handleDownload = async (reportId: string, format: 'csv' | 'pdf' | 'json' = 'csv') => {
    try {
      const response = await fetch(`/api/capital-gains-reports/${reportId}/download?format=${format}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Get filename from Content-Disposition header if available
      const disposition = response.headers.get('Content-Disposition');
      let filename = `capital-gains-report.${format}`;
      if (disposition) {
        const filenameMatch = disposition.match(/filename="(.+)"/); 
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: `Capital gains report download started in ${format.toUpperCase()} format`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Capital Gains Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Client ID</label>
              <Input
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                placeholder="Enter client ID"
                data-testid="input-client-id"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Financial Year</label>
              <Select value={selectedFY} onValueChange={setSelectedFY}>
                <SelectTrigger data-testid="select-financial-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {financialYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Source</label>
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger data-testid="select-report-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(source => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleFetchFromMFCentral}
              disabled={fetchFromMFCentralMutation.isPending}
              data-testid="button-fetch-mf-central"
            >
              {fetchFromMFCentralMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Fetch from MF Central
            </Button>
            <Button variant="outline" data-testid="button-refresh-reports">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Summary Cards */}
      {reports && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Long Term Gains</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(reports.reduce((sum: number, report: CapitalGainsReport) => 
                      sum + parseFloat(report.totalLongTermGains || '0'), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Short Term Gains</p>
                  <p className="font-semibold text-orange-600">
                    {formatCurrency(reports.reduce((sum: number, report: CapitalGainsReport) => 
                      sum + parseFloat(report.totalShortTermGains || '0'), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Dividend</p>
                  <p className="font-semibold text-blue-600">
                    {formatCurrency(reports.reduce((sum: number, report: CapitalGainsReport) => 
                      sum + parseFloat(report.totalDividend || '0'), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total TDS Deducted</p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(reports.reduce((sum: number, report: CapitalGainsReport) => 
                      sum + parseFloat(report.totalTdsDeducted || '0'), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
        </CardHeader>
        <CardContent>
          {reports && reports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Financial Year</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Long Term Gains</TableHead>
                  <TableHead>Short Term Gains</TableHead>
                  <TableHead>Dividend</TableHead>
                  <TableHead>TDS Deducted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report: CapitalGainsReport) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.financialYear}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {report.source.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(report.totalLongTermGains)}
                    </TableCell>
                    <TableCell className="text-orange-600">
                      {formatCurrency(report.totalShortTermGains)}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {formatCurrency(report.totalDividend)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(report.totalTdsDeducted)}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell>
                      {new Date(report.generatedAt).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownload(report.id, 'csv')}
                          data-testid={`button-download-csv-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          CSV
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownload(report.id, 'pdf')}
                          data-testid={`button-download-pdf-${report.id}`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No capital gains reports found for the selected criteria.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Try fetching reports from external sources using the buttons above.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}