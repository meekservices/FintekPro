import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link as RouterLink } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Users, Activity, TrendingUp, MessageSquare, Settings, Search, Filter, Shield, FileText, Building2, Plus, Edit3, Trash2, Server, Brain, Zap, Lock, Receipt, CheckCircle, Calendar, Download, Loader2, IndianRupee, Clock, Eye, Edit, Send, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Bot, Monitor, BarChart, Globe, Mail, Target, TrendingDown, Share2, Megaphone, MousePointer, Users2, BarChart3, PieChart, LineChart, Phone, ChevronLeft, ChevronRight, Menu, MessageCircle, Smartphone, Link, UserCheck, Building, Network, ArrowRightLeft, Handshake, Lightbulb, TestTube, AlertCircle, Info, Database, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RiskProfileViewer } from "@/components/risk-profiling/risk-profile-viewer";
import { RiskAssessmentForm } from "@/components/risk-profiling/risk-assessment-form";
import { CapitalGainsReportViewer } from "@/components/reports/capital-gains-report-viewer";
import { TransactionReportViewer } from "@/components/reports/transaction-report-viewer";
import CkycManagement from "./admin/ckyc-management";
import SupplierDashboard from "./admin/supplier-dashboard";


// Enhanced API Status Panel Component
function ApiStatusPanel() {
  const { data: apiStatus = {}, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/public/api-status'], // Using public endpoint for testing
    refetchInterval: 10000, // Refresh every 10 seconds for real-time monitoring
  });

  const { data: apiKeys = {}, refetch: refetchApiKeys } = useQuery({
    queryKey: ['/api/admin/api-keys'],
    enabled: true // Only fetch for admin users
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [keyValue, setKeyValue] = useState('');
  const { toast } = useToast();

  const updateApiKeyMutation = useMutation({
    mutationFn: async ({ keyName, keyValue }: { keyName: string; keyValue: string }) => {
      return await apiRequest('POST', '/api/admin/api-keys', { keyName, keyValue });
    },
    onSuccess: () => {
      toast({
        title: "API Key Updated",
        description: "The API key has been updated successfully",
      });
      setEditDialogOpen(false);
      setKeyValue('');
      refetchApiKeys();
      refetch(); // Refresh API status
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update API key",
        variant: "destructive"
      });
    }
  });

  const handleEditApiKey = (keyName: string) => {
    setSelectedApiKey(keyName);
    setKeyValue('');
    setEditDialogOpen(true);
  };

  const handleSaveApiKey = () => {
    if (!selectedApiKey || !keyValue.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }
    updateApiKeyMutation.mutate({ keyName: selectedApiKey, keyValue: keyValue.trim() });
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'partial':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'configured':
      case 'available':
        return 'text-green-600 bg-green-50';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50';
      case 'not_configured':
        return 'text-blue-600 bg-blue-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'configured':
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'not_configured':
        return <Settings className="w-4 h-4 text-blue-600" />;
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-red-600" />;
      default:
        return <Monitor className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Checking API status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <ShieldAlert className="w-5 h-5" />
            API Status Monitor - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Failed to fetch API status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <Card className={`border-2 ${getOverallStatusColor((apiStatus as any)?.overall)}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Monitor className="w-6 h-6" />
              System Status: {((apiStatus as any)?.overall || 'unknown').toUpperCase()}
            </CardTitle>
            <div className="text-sm text-gray-500">
              Last updated: {(apiStatus as any)?.timestamp ? new Date((apiStatus as any).timestamp).toLocaleTimeString() : 'Unknown'}
            </div>
          </div>
          <div className="text-sm opacity-80">
            Comprehensive monitoring of all integrated APIs and system components
          </div>
        </CardHeader>
      </Card>

      {/* Individual API Services Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-6 h-6 text-blue-600" />
            Individual API Services Monitor ({Object.keys((apiStatus as any)?.apis || {}).length})
          </CardTitle>
          <CardDescription>
            Real-time individual status monitoring with detailed health metrics for each integrated service
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* API Status Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'healthy' || api.status === 'configured').length}
              </div>
              <div className="text-sm text-green-600 font-medium">Healthy</div>
            </div>
            <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">
                {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'degraded').length}
              </div>
              <div className="text-sm text-yellow-600 font-medium">Degraded</div>
            </div>
            <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'error').length}
              </div>
              <div className="text-sm text-red-600 font-medium">Error</div>
            </div>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'not_configured').length}
              </div>
              <div className="text-sm text-blue-600 font-medium">Not Configured</div>
            </div>
          </div>

          {/* Individual API Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Object.entries((apiStatus as any)?.apis || {}).map(([key, api]: [string, any]) => {
              const getApiTypeIcon = (apiName: string) => {
                const name = apiName?.toLowerCase() || '';
                if (name.includes('database') || name.includes('postgresql')) return <Server className="w-5 h-5" />;
                if (name.includes('yahoo') || name.includes('finance')) return <TrendingUp className="w-5 h-5" />;
                if (name.includes('jm financial')) return <Building2 className="w-5 h-5" />;
                if (name.includes('interactive') || name.includes('brokers')) return <BarChart3 className="w-5 h-5" />;
                return <Globe className="w-5 h-5" />;
              };

              const getResponseTimeColor = (responseTime: string) => {
                const time = parseInt(responseTime?.replace(/[^\d]/g, '') || '0');
                if (time < 200) return 'text-green-600';
                if (time < 1000) return 'text-yellow-600';
                return 'text-red-600';
              };

              const getStatusBadgeClass = (status: string) => {
                switch (status) {
                  case 'healthy':
                  case 'configured':
                  case 'available':
                    return 'bg-green-100 text-green-700 border-green-300';
                  case 'degraded':
                    return 'bg-yellow-100 text-yellow-700 border-yellow-300';
                  case 'error':
                    return 'bg-red-100 text-red-700 border-red-300';
                  case 'not_configured':
                    return 'bg-blue-100 text-blue-700 border-blue-300';
                  default:
                    return 'bg-gray-100 text-gray-700 border-gray-300';
                }
              };

              return (
                <Card key={key} className={`transition-all duration-300 border-2 hover:shadow-lg hover:scale-[1.02] ${getStatusColor(api.status)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white bg-opacity-70 shadow-sm">
                          {getApiTypeIcon(api.name)}
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg text-gray-900 leading-tight">
                            {api.name || key}
                          </CardTitle>
                          <Badge 
                            variant="outline" 
                            className={`mt-1 text-xs font-medium ${getStatusBadgeClass(api.status)}`}
                          >
                            {api.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {getStatusIcon(api.status)}
                        {/* Add edit button for configurable API keys */}
                        {(key.toUpperCase().includes('GEMINI') || 
                          key.toUpperCase().includes('ALPHA_VANTAGE') ||
                          key.toUpperCase().includes('OPENAI') ||
                          key.toUpperCase().includes('ICICI') ||
                          key.toUpperCase().includes('HDFC') ||
                          key.toUpperCase().includes('JM_FINANCIAL') ||
                          key.toUpperCase().includes('JM_FINANCIAL')) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditApiKey(key.toUpperCase().replace(/\s+/g, '_') + '_API_KEY')}
                            className="h-8 w-8 p-0"
                            data-testid={`button-edit-api-key-${key}`}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 leading-relaxed">{api.details}</p>
                      
                      {/* Performance Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white bg-opacity-60 p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1 font-medium">Response Time</div>
                          <div className={`text-sm font-bold ${getResponseTimeColor(api.responseTime)}`}>
                            {api.responseTime || 'N/A'}
                          </div>
                        </div>
                        <div className="bg-white bg-opacity-60 p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1 font-medium">Last Check</div>
                          <div className="text-sm font-medium text-gray-700">
                            {api.lastChecked ? new Date(api.lastChecked).toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            }) : 'Never'}
                          </div>
                        </div>
                      </div>

                      {/* Connection Details */}
                      {(api.endpoint || api.url) && (
                        <div className="bg-gray-50 p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1 font-medium">Endpoint</div>
                          <div className="text-sm text-gray-700 font-mono break-all">
                            {api.endpoint || api.url}
                          </div>
                        </div>
                      )}

                      {/* Error Information */}
                      {api.error && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                          <div className="text-xs text-red-500 mb-1 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Error Details
                          </div>
                          <div className="text-sm text-red-700 leading-tight">
                            {api.error}
                          </div>
                        </div>
                      )}

                      {/* Status-specific Information */}
                      {api.status === 'not_configured' && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                          <div className="text-xs text-blue-500 mb-1 font-medium flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            Configuration Required
                          </div>
                          <div className="text-sm text-blue-700 leading-tight">
                            This API requires configuration. Please check environment variables or settings.
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {api.recommendations && (
                        <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg">
                          <div className="text-xs text-indigo-500 mb-1 font-medium flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" />
                            Recommendations
                          </div>
                          <div className="text-sm text-indigo-700 leading-tight">
                            {api.recommendations}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Health Metrics */}
      {apiStatus?.systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
            <CardDescription>
              Server performance metrics and resource utilization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatUptime(apiStatus.systemHealth.uptime)}
                </div>
                <div className="text-sm text-gray-600 mt-1">System Uptime</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatMemory(apiStatus.systemHealth.memory.heapUsed)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Memory Used</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {apiStatus.systemHealth.nodeVersion}
                </div>
                <div className="text-sm text-gray-600 mt-1">Node.js Version</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {apiStatus.systemHealth.totalResponseTime}
                </div>
                <div className="text-sm text-gray-600 mt-1">Check Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations & Actions */}
      {apiStatus?.recommendations && apiStatus.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Recommendations & Actions ({apiStatus.recommendations.length})
            </CardTitle>
            <CardDescription>
              System insights and recommended actions to improve performance and reliability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {apiStatus.recommendations.map((rec: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(rec.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {rec.severity === 'critical' && <ShieldAlert className="w-5 h-5 text-red-600" />}
                      {rec.severity === 'high' && <AlertTriangle className="w-5 h-5 text-orange-600" />}
                      {rec.severity === 'medium' && <AlertCircle className="w-5 h-5 text-yellow-600" />}
                      {rec.severity === 'low' && <Info className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={getSeverityColor(rec.severity)}>
                          {rec.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="font-medium text-gray-900 mb-1">{rec.message}</div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Recommended Action:</span> {rec.action}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            API Configuration ({Object.keys(apiKeys?.data || {}).length})
          </CardTitle>
          <CardDescription>
            Manage and configure API keys for external service integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(apiKeys.data || {}).map(([keyName, status]: [string, any]) => {
              const getKeyStatusColor = (status: string) => {
                return status === 'configured' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';
              };

              const getKeyStatusIcon = (status: string) => {
                return status === 'configured' ? 
                  <CheckCircle className="w-4 h-4 text-green-600" /> : 
                  <AlertTriangle className="w-4 h-4 text-red-600" />;
              };

              const getServiceName = (keyName: string) => {
                return keyName.replace(/_API_KEY$/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              };

              return (
                <Card key={keyName} className={`transition-all duration-300 border hover:shadow-md ${getKeyStatusColor(status)}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getKeyStatusIcon(status)}
                        <div>
                          <CardTitle className="text-sm text-gray-900">
                            {getServiceName(keyName)}
                          </CardTitle>
                          <Badge 
                            variant={status === 'configured' ? 'default' : 'destructive'}
                            className="text-xs mt-1"
                          >
                            {status === 'configured' ? 'Configured' : 'Not Configured'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditApiKey(keyName)}
                        className="h-8 w-8 p-0"
                        data-testid={`button-edit-key-${keyName}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground">
                      {status === 'configured' ? 
                        'API key is configured and ready for use' : 
                        'API key needs to be configured for this service'
                      }
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Manual API Test Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            Manual API Tests
          </CardTitle>
          <CardDescription>
            Test individual API endpoints and troubleshoot connection issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => window.open('https://finance.yahoo.com', '_blank')}
            >
              <Globe className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Test Yahoo Finance</div>
                <div className="text-xs text-gray-500">Check market data source</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => {
                // Test database connection by refetching
                window.location.reload();
              }}
            >
              <Database className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Test Database</div>
                <div className="text-xs text-gray-500">Verify DB connectivity</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto p-4"
              onClick={() => {
                // Force refresh API status
                window.location.href = window.location.href;
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Refresh Status</div>
                <div className="text-xs text-gray-500">Force status check</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Key Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Edit API Key
            </DialogTitle>
            <DialogDescription>
              Update the API key for {selectedApiKey?.replace(/_/g, ' ')}. This change will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-input">API Key</Label>
              <Input
                id="api-key-input"
                type="password"
                placeholder="Enter new API key..."
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                data-testid="input-api-key"
              />
              <p className="text-xs text-muted-foreground">
                The API key will be stored securely and validated immediately.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel-api-key"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={updateApiKeyMutation.isPending || !keyValue.trim()}
              data-testid="button-save-api-key"
            >
              {updateApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Update Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



// Marketing Tools Panel Component for Campaign Management and Analytics
function MarketingToolsPanel() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('overview');
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState([
    {
      id: 'campaign-1',
      name: 'Q1 Investment Drive',
      type: 'email',
      status: 'active',
      reach: 15420,
      clicks: 2340,
      conversions: 156,
      budget: 25000,
      spent: 18750,
      startDate: '2024-01-15',
      endDate: '2024-03-31'
    },
    {
      id: 'campaign-2',
      name: 'Mutual Fund Awareness',
      type: 'social',
      status: 'paused',
      reach: 8900,
      clicks: 890,
      conversions: 45,
      budget: 15000,
      spent: 7200,
      startDate: '2024-01-20',
      endDate: '2024-02-20'
    }
  ]);

  const [leads, setLeads] = useState([
    {
      id: 'lead-1',
      name: 'Rajesh Kumar',
      email: 'rajesh@email.com',
      phone: '+91-9876543210',
      source: 'Website Form',
      interest: 'Mutual Funds',
      status: 'hot',
      score: 85,
      createdAt: '2024-01-20'
    },
    {
      id: 'lead-2',
      name: 'Priya Sharma',
      email: 'priya.s@email.com',
      phone: '+91-8765432109',
      source: 'Social Media',
      interest: 'Portfolio Management',
      status: 'warm',
      score: 72,
      createdAt: '2024-01-18'
    }
  ]);

  const marketingMetrics = {
    totalLeads: leads.length,
    hotLeads: leads.filter(l => l.status === 'hot').length,
    conversionRate: 12.8,
    costPerLead: 245,
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalSpend: campaigns.reduce((sum, c) => sum + c.spent, 0),
    totalReach: campaigns.reduce((sum, c) => sum + c.reach, 0)
  };

  const handleCreateCampaign = () => {
    setIsCreatingCampaign(true);
    // Simulate campaign creation
    setTimeout(() => {
      toast({
        title: "Campaign Created",
        description: "Your marketing campaign has been created successfully",
      });
      setIsCreatingCampaign(false);
    }, 2000);
  };

  const handleLeadAction = (leadId: string, action: string) => {
    toast({
      title: `Lead ${action}`,
      description: `Successfully ${action.toLowerCase()} lead`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Marketing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.hotLeads} hot leads
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              {marketingMetrics.totalCampaigns} total campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.costPerLead} cost per lead
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{marketingMetrics.totalReach.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ₹{marketingMetrics.totalSpend.toLocaleString()} total spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Tools Navigation */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeView === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveView('overview')}
          size="sm"
        >
          <BarChart className="w-4 h-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'campaigns' ? 'default' : 'outline'}
          onClick={() => setActiveView('campaigns')}
          size="sm"
        >
          <Target className="w-4 h-4 mr-2" />
          Campaigns
        </Button>
        <Button
          variant={activeView === 'leads' ? 'default' : 'outline'}
          onClick={() => setActiveView('leads')}
          size="sm"
        >
          <Users2 className="w-4 h-4 mr-2" />
          Leads
        </Button>
        <Button
          variant={activeView === 'email' ? 'default' : 'outline'}
          onClick={() => setActiveView('email')}
          size="sm"
        >
          <Mail className="w-4 h-4 mr-2" />
          Email Marketing
        </Button>
        <Button
          variant={activeView === 'social' ? 'default' : 'outline'}
          onClick={() => setActiveView('social')}
          size="sm"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Social Media
        </Button>
        <Button
          variant={activeView === 'whatsapp' ? 'default' : 'outline'}
          onClick={() => setActiveView('whatsapp')}
          size="sm"
        >
          <Phone className="w-4 h-4 mr-2" />
          WhatsApp Marketing
        </Button>
      </div>

      {/* Campaign Management */}
      {activeView === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Campaign Management</h3>
            <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}>
              <Plus className="w-4 h-4 mr-2" />
              {isCreatingCampaign ? 'Creating...' : 'New Campaign'}
            </Button>
          </div>

          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      <CardDescription>
                        {campaign.type.toUpperCase()} • {campaign.startDate} to {campaign.endDate}
                      </CardDescription>
                    </div>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Reach</p>
                      <p className="text-lg font-semibold">{campaign.reach.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Clicks</p>
                      <p className="text-lg font-semibold">{campaign.clicks.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversions</p>
                      <p className="text-lg font-semibold">{campaign.conversions}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Budget Usage</p>
                      <p className="text-lg font-semibold">
                        ₹{campaign.spent.toLocaleString()} / ₹{campaign.budget.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <BarChart className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                    <Button size="sm" variant="outline">
                      {campaign.status === 'active' ? 'Pause' : 'Resume'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Lead Management */}
      {activeView === 'leads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Lead Management</h3>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Import Leads
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Interest</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{lead.email}</div>
                          <div className="text-muted-foreground">{lead.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>{lead.interest}</TableCell>
                      <TableCell>
                        <Badge variant={
                          lead.status === 'hot' ? 'destructive' : 
                          lead.status === 'warm' ? 'default' : 'secondary'
                        }>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{lead.score}</div>
                          <div className="w-16 bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Contact')}>
                            <Phone className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Email')}>
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleLeadAction(lead.id, 'Edit')}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Marketing */}
      {activeView === 'email' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Email Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Campaign Builder</CardTitle>
                <CardDescription>Create and send targeted email campaigns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input placeholder="Enter campaign name" />
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      <SelectItem value="new">New Clients</SelectItem>
                      <SelectItem value="active">Active Investors</SelectItem>
                      <SelectItem value="inactive">Inactive Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                      <SelectItem value="welcome">Welcome Series</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Analytics</CardTitle>
                <CardDescription>Track email campaign performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Rate</span>
                    <span className="font-medium">24.5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Click Rate</span>
                    <span className="font-medium">8.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bounce Rate</span>
                    <span className="font-medium">2.1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unsubscribe Rate</span>
                    <span className="font-medium">0.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sent</span>
                    <span className="font-medium">12,450</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Social Media Marketing */}
      {activeView === 'social' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Social Media Marketing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Facebook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">8,420</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">6.8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Reach</span>
                    <span className="font-medium">45,200</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  LinkedIn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Connections</span>
                    <span className="font-medium">12,680</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">12.4%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">89,300</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Twitter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Followers</span>
                    <span className="font-medium">5,240</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Engagement</span>
                    <span className="font-medium">4.2%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Impressions</span>
                    <span className="font-medium">32,100</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Scheduler</CardTitle>
              <CardDescription>Schedule posts across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="What's on your mind? Share investment tips, market insights, or educational content..." />
              <div className="flex gap-2">
                <Button size="sm" variant="outline">📷 Add Image</Button>
                <Button size="sm" variant="outline">📊 Add Chart</Button>
                <Button size="sm" variant="outline">🔗 Add Link</Button>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Badge variant="secondary">Facebook</Badge>
                  <Badge variant="secondary">LinkedIn</Badge>
                  <Badge variant="outline">Twitter</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">Schedule</Button>
                  <Button size="sm">Post Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Marketing */}
      {activeView === 'whatsapp' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">WhatsApp Marketing Center</h3>
            <div className="flex gap-2">
              <RouterLink href="/admin/whatsapp-setup">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  WhatsApp Setup
                </Button>
              </RouterLink>
              <Button onClick={() => toast({ title: "WhatsApp Connected", description: "Your WhatsApp Business API is active and ready" })}>
                <Phone className="w-4 h-4 mr-2" />
                Connect WhatsApp Business
              </Button>
            </div>
          </div>

          {/* WhatsApp Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,847</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89.2%</div>
                <p className="text-xs text-muted-foreground">Industry leading</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">34.7%</div>
                <p className="text-xs text-muted-foreground">+5.2% increase</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">Opted-in contacts</p>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Campaign Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Broadcast Campaign
                </CardTitle>
                <CardDescription>Send marketing messages to segmented audiences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Campaign Type</Label>
                  <Select defaultValue="portfolio-update">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio-update">Portfolio Updates</SelectItem>
                      <SelectItem value="market-alerts">Market Alerts</SelectItem>
                      <SelectItem value="educational">Educational Content</SelectItem>
                      <SelectItem value="promotional">Promotional Offers</SelectItem>
                      <SelectItem value="onboarding">New User Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select defaultValue="active-traders">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-users">All Users</SelectItem>
                      <SelectItem value="new-users">New Users (Last 30 days)</SelectItem>
                      <SelectItem value="active-traders">Active Traders</SelectItem>
                      <SelectItem value="long-term-investors">Long-term Investors</SelectItem>
                      <SelectItem value="inactive-users">Inactive Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Textarea 
                    placeholder="🏦 *Market Update from FintekPro*

Hi {{name}}, your portfolio has gained {{gain}}% today! 

📊 Top performers:
• {{stock1}}: +{{percent1}}%
• {{stock2}}: +{{percent2}}%

💡 AI Recommendation: {{recommendation}}

Login to view detailed analysis: {{app_link}}"
                    className="min-h-[150px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => toast({ title: "Preview Ready", description: "WhatsApp message preview generated" })}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => toast({ title: "Campaign Scheduled", description: "WhatsApp broadcast will be sent to 1,234 contacts" })}>
                    <Send className="w-4 h-4 mr-2" />
                    Send Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI-Powered Automation
                </CardTitle>
                <CardDescription>Automated WhatsApp marketing sequences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Welcome Sequence</p>
                      <p className="text-sm text-muted-foreground">3-message onboarding flow</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Automation</p>
                      <p className="text-sm text-muted-foreground">Triggered by significant movements</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Performance</p>
                      <p className="text-sm text-muted-foreground">Weekly summary messages</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Paused</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Re-engagement Campaign</p>
                      <p className="text-sm text-muted-foreground">For inactive users (30+ days)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Active</Badge>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => toast({ title: "New Automation", description: "Create a new WhatsApp automation sequence" })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Automation
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Analytics & Templates */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>Pre-approved WhatsApp Business templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Portfolio Alert</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      🚨 Your portfolio {"{{action}}"} by {"{{percentage}}"}% today. Check the details...
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Market Insight</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      📊 Market Update: {"{{market_summary}}"}. AI recommends: {"{{recommendation}}"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium">Educational Tip</p>
                      <Badge variant="secondary">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      💡 Investment Tip: {"{{educational_content}}"}. Learn more in the app.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="outline">Use Template</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Campaign Performance</CardTitle>
                <CardDescription>Last 7 days WhatsApp campaign metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Market Alert Campaign</p>
                      <p className="text-sm text-muted-foreground">Sent 2 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">89.2% read</p>
                      <p className="text-sm text-muted-foreground">1,234 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Summary</p>
                      <p className="text-sm text-muted-foreground">Sent 5 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">76.8% read</p>
                      <p className="text-sm text-muted-foreground">987 sent</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Educational Content</p>
                      <p className="text-sm text-muted-foreground">Sent 7 days ago</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">92.1% read</p>
                      <p className="text-sm text-muted-foreground">1,456 sent</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600">86.4%</p>
                      <p className="text-sm text-muted-foreground">Avg. Read Rate</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">28.7%</p>
                      <p className="text-sm text-muted-foreground">Click-through Rate</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Capabilities Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                WhatsApp Marketing Capabilities
              </CardTitle>
              <CardDescription>
                Comprehensive WhatsApp Business API integration for automated marketing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Automated Campaigns
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• AI-powered portfolio updates</li>
                    <li>• Market alert notifications</li>
                    <li>• Educational content delivery</li>
                    <li>• User onboarding sequences</li>
                    <li>• Re-engagement campaigns</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Smart Targeting
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• User segmentation by activity</li>
                    <li>• Investment behavior analysis</li>
                    <li>• Portfolio performance targeting</li>
                    <li>• Risk profile based messaging</li>
                    <li>• Personalized recommendations</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <BarChart className="w-4 h-4" />
                    Analytics & Tracking
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time delivery status</li>
                    <li>• Read receipt tracking</li>
                    <li>• Click-through rate analysis</li>
                    <li>• Conversion tracking</li>
                    <li>• ROI measurement</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overview Dashboard */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Marketing Dashboard</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.slice(0, 3).map((campaign) => (
                    <div key={campaign.id} className="flex justify-between items-center p-3 border rounded">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.conversions} conversions • {((campaign.clicks / campaign.reach) * 100).toFixed(1)}% CTR
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Website Forms</span>
                    <span className="font-medium">45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Social Media</span>
                    <span className="font-medium">28%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Email Campaigns</span>
                    <span className="font-medium">18%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Referrals</span>
                    <span className="font-medium">9%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientStats {
  totalClients: number;
  activeClients: number;
  newClientsToday: number;
  totalLogins: number;
  avgSessionTime: number;
}

interface ActivityMetrics {
  pageViews: number;
  apiCalls: number;
  trades: number;
  portfolioViews: number;
  topActions: Array<{ action: string; count: number }>;
}

interface PlatformInsights {
  clientGrowth: Array<{ date: string; count: number }>;
  popularFeatures: Array<{ feature: string; usage: number }>;
  clientEngagement: {
    dailyActiveClients: number;
    weeklyActiveClients: number;
    monthlyActiveClients: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: number;
    responseTime: number;
  };
}

interface Client {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface ClientActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// Comprehensive User Management Component
function ComprehensiveUserManagement() {
  const { toast } = useToast();
  const [selectedUserType, setSelectedUserType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['/api/admin/users', selectedUserType, searchQuery, statusFilter, roleFilter],
    enabled: true
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string, updates: any }) => {
      const response = await apiRequest('PUT', `/api/admin/users/${userId}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User updated successfully' });
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ userIds, updates }: { userIds: string[], updates: any }) => {
      const response = await apiRequest('POST', '/api/admin/users/bulk-update', { userIds, updates });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setSelectedUsers([]);
      toast({ title: 'Bulk update completed successfully' });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: 'User deleted successfully' });
    }
  });

  const getUserTypeColor = (role: string) => {
    const colors = {
      'user': 'bg-blue-100 text-blue-800',
      'client': 'bg-green-100 text-green-800',
      'partner': 'bg-purple-100 text-purple-800',
      'supplier': 'bg-orange-100 text-orange-800',
      'agent': 'bg-cyan-100 text-cyan-800',
      'admin': 'bg-red-100 text-red-800',
      'super_admin': 'bg-gray-800 text-white'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleBulkAction = (action: string) => {
    if (selectedUsers.length === 0) {
      toast({ title: 'No users selected', variant: 'destructive' });
      return;
    }

    switch (action) {
      case 'activate':
        bulkUpdateMutation.mutate({ userIds: selectedUsers, updates: { isActive: true } });
        break;
      case 'deactivate':
        bulkUpdateMutation.mutate({ userIds: selectedUsers, updates: { isActive: false } });
        break;
      case 'send_notification':
        // Open notification modal for bulk users
        break;
    }
  };

  const userStats = {
    total: (usersData as any)?.total || 0,
    clients: (usersData as any)?.stats?.clients || 0,
    partners: (usersData as any)?.stats?.partners || 0,
    suppliers: (usersData as any)?.stats?.suppliers || 0,
    agents: (usersData as any)?.stats?.agents || 0,
    active: (usersData as any)?.stats?.active || 0,
    inactive: (usersData as any)?.stats?.inactive || 0
  };

  return (
    <div className="space-y-6">
      {/* User Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{userStats.clients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partners</CardTitle>
            <Building2 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{userStats.partners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{userStats.suppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <ShieldCheck className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">{userStats.agents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{userStats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{userStats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            User Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>User Type</Label>
              <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="user">Standard Users</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="partner">Partners</SelectItem>
                  <SelectItem value="supplier">Suppliers</SelectItem>
                  <SelectItem value="agent">Agents</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Regular User</SelectItem>
                  <SelectItem value="premium">Premium User</SelectItem>
                  <SelectItem value="vip">VIP Client</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedUsers.length} users selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUsers([])}
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleBulkAction('activate')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Activate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('deactivate')}>
                  <Clock className="h-4 w-4 mr-1" />
                  Deactivate
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('send_notification')}>
                  <Send className="h-4 w-4 mr-1" />
                  Send Message
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Management</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowBulkActions(!showBulkActions)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add User
              </Button>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers((usersData as any)?.users?.map((u: any) => u.id) || []);
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                        checked={selectedUsers.length === (usersData as any)?.users?.length}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type/Role</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usersData as any)?.users?.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            {user.firstName?.[0] || user.email?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName || ''}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getUserTypeColor(user.role || 'user')}>
                            {user.role || 'User'}
                          </Badge>
                          {user.userType && (
                            <div className="text-xs text-muted-foreground">
                              {user.userType}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{user.email}</div>
                          {user.mobile && (
                            <div className="text-xs text-muted-foreground">
                              {user.mobile}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.lastLoginAt 
                            ? format(new Date(user.lastLoginAt), 'MMM dd, yyyy')
                            : 'Never'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this user?')) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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
    </div>
  );
}

export default function AdminPanel() {
  const { toast } = useToast();
  
  // Get current user to check if super admin
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guidanceDialog, setGuidanceDialog] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState({
    title: "",
    message: "",
    type: "guidance",
    priority: "medium",
    actionUrl: ""
  });
  const [createClientDialog, setCreateClientDialog] = useState(false);
  const [editClientDialog, setEditClientDialog] = useState(false);
  const [deleteClientDialog, setDeleteClientDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [showAddAgentDialog, setShowAddAgentDialog] = useState(false);
  const [showEditAgentDialog, setShowEditAgentDialog] = useState(false);
  const [showDeleteAgentDialog, setShowDeleteAgentDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [agentForm, setAgentForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    employeeId: "",
    euinNumber: "",
    arnCode: "",
    distributorId: "",
    specializations: [] as string[],
    status: "active",
    maxTicketsPerDay: 50
  });
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    role: "user",
    isActive: true
  });

  // Fetch dashboard data
  const { data: dashboardData = {}, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch agents data
  const { data: agentsData = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/admin/agents'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch client-agent relationships data
  const { data: relationshipsData = [], isLoading: relationshipsLoading } = useQuery({
    queryKey: ['/api/admin/client-agent-relationships'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch relationships statistics
  const { data: relationshipsStats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/client-agent-relationships/stats'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch clients with filtering
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["/api/admin/users", { searchTerm, role: roleFilter, isActive: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter);
      
      return fetch(`/api/admin/users?${params}`).then(res => res.json());
    }
  });

  // Fetch platform insights
  const { data: insights } = useQuery({
    queryKey: ["/api/admin/insights"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/admin/activities"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Agent management mutations
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: any) => {
      const response = await apiRequest('POST', '/api/admin/agents', agentData);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Agent created successfully" });
      setShowAddAgentDialog(false);
      setAgentForm({ fullName: "", email: "", phone: "", employeeId: "", euinNumber: "", arnCode: "", distributorId: "", specializations: [], status: "active", maxTicketsPerDay: 50 });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agents'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create agent", variant: "destructive" });
    }
  });

  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await apiRequest('PATCH', `/api/admin/agents/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Agent updated successfully" });
      setShowEditAgentDialog(false);
      setSelectedAgent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agents'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update agent", variant: "destructive" });
    }
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await apiRequest('DELETE', `/api/admin/agents/${agentId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Agent deleted successfully" });
      setShowDeleteAgentDialog(false);
      setSelectedAgent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agents'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete agent", variant: "destructive" });
    }
  });

  // Agent management handlers
  const handleEditAgent = (agent: any) => {
    setSelectedAgent(agent);
    setAgentForm({
      fullName: agent.fullName || "",
      email: agent.email || "",
      phone: agent.phone || "",
      employeeId: agent.employeeId || "",
      euinNumber: agent.euinNumber || "",
      arnCode: agent.arnCode || "",
      distributorId: agent.distributorId || "",
      specializations: agent.specializations || [],
      status: agent.status || "active",
      maxTicketsPerDay: agent.maxTicketsPerDay || 50
    });
    setShowEditAgentDialog(true);
  };

  const handleDeleteAgent = (agent: any) => {
    setSelectedAgent(agent);
    setShowDeleteAgentDialog(true);
  };

  const handleCreateAgent = () => {
    createAgentMutation.mutate(agentForm);
  };

  const handleUpdateAgent = () => {
    if (selectedAgent) {
      updateAgentMutation.mutate({ id: selectedAgent.id, ...agentForm });
    }
  };

  const handleConfirmDeleteAgent = () => {
    if (selectedAgent) {
      deleteAgentMutation.mutate(selectedAgent.id);
    }
  };

  // Update client role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ clientId, role }: { clientId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ clientId, isActive }: { clientId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Client status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send guidance mutation
  const sendGuidanceMutation = useMutation({
    mutationFn: async ({ clientId, guidance }: { clientId: string; guidance: any }) => {
      const response = await apiRequest("POST", `/api/admin/users/${clientId}/guidance`, guidance);
      return response.json();
    },
    onSuccess: () => {
      setGuidanceDialog(false);
      setGuidanceForm({
        title: "",
        message: "",
        type: "guidance",
        priority: "medium",
        actionUrl: ""
      });
      toast({
        title: "Success",
        description: "Guidance sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: any) => {
      const response = await apiRequest("POST", "/api/admin/users", clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCreateClientDialog(false);
      setClientForm({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        role: "user",
        isActive: true
      });
      toast({
        title: "Success",
        description: "Client created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, clientData }: { clientId: string; clientData: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${clientId}`, clientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditClientDialog(false);
      setSelectedClient(null);
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/users/${clientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteClientDialog(false);
      setClientToDelete(null);
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const { clientStats, activityMetrics, platformInsights: dashboardInsights } = (dashboardData as any) || {
    clientStats: { totalClients: 0, activeClients: 0, newClientsToday: 0, totalLogins: 0, avgSessionTime: 0 },
    activityMetrics: { pageViews: 0, apiCalls: 0, trades: 0, portfolioViews: 0, topActions: [] },
    platformInsights: { systemHealth: { uptime: "0h 0m", errorRate: 0, responseTime: 0 } }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" data-testid="admin-panel">
      {/* Enhanced Header with Gradient Background */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-xl">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-admin-title">
                FintekPro Admin Center
              </h1>
              <p className="text-indigo-100 text-lg" data-testid="text-admin-subtitle">
                Complete platform management & analytics dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">System Online</span>
              </div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30" data-testid="badge-admin-status">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Super Admin
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        <Tabs defaultValue="dashboard" orientation="vertical" className="w-full h-full flex">
          {/* Enhanced Collapsible Left Sidebar */}
          <div className={`${sidebarCollapsed ? 'w-20' : 'w-72'} border-r bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xl flex-shrink-0 border-slate-200/50 transition-all duration-300 ease-in-out`}>
            <div className="p-4">
              <div className="mb-6 flex justify-between items-center">
                {!sidebarCollapsed && (
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Navigation
                  </h3>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hover:bg-slate-100 dark:hover:bg-slate-800 p-2"
                  data-testid="button-toggle-sidebar"
                >
                  {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </Button>
              </div>
            </div>
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-4 space-y-2">
              <TabsTrigger 
                value="dashboard" 
                data-testid="tab-dashboard"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 dark:data-[state=active]:shadow-indigo-900/50`}
                title={sidebarCollapsed ? "Dashboard" : undefined}
              >
                <TrendingUp className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Dashboard</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="comprehensive-users" 
                data-testid="tab-comprehensive-users"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-200 dark:data-[state=active]:shadow-blue-900/50`}
                title={sidebarCollapsed ? "All Users" : undefined}
              >
                <Users2 className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">All Users</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="clients" 
                data-testid="tab-clients"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-200 dark:data-[state=active]:shadow-emerald-900/50`}
                title={sidebarCollapsed ? "Clients" : undefined}
              >
                <Users className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Clients</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                data-testid="tab-activity"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200 dark:data-[state=active]:shadow-orange-900/50`}
                title={sidebarCollapsed ? "Activity" : undefined}
              >
                <Activity className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Activity</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="ckyc" 
                data-testid="tab-ckyc"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-200 dark:data-[state=active]:shadow-violet-900/50`}
                title={sidebarCollapsed ? "CKYC Management" : undefined}
              >
                <Shield className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">CKYC Management</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="api-status" 
                data-testid="tab-api-status"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-teal-200 dark:data-[state=active]:shadow-teal-900/50`}
                title={sidebarCollapsed ? "API Status" : undefined}
              >
                <Server className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">API Status</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="error-monitoring" 
                data-testid="tab-error-monitoring"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-yellow-200 dark:data-[state=active]:shadow-yellow-900/50`}
                title={sidebarCollapsed ? "AI Monitor" : undefined}
              >
                <Brain className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">AI Monitor</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="insights" 
                data-testid="tab-insights"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-500 data-[state=active]:to-slate-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-gray-200 dark:data-[state=active]:shadow-gray-900/50`}
                title={sidebarCollapsed ? "Insights" : undefined}
              >
                <Settings className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Insights</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="risk-profiling" 
                data-testid="tab-risk-profiling"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-200 dark:data-[state=active]:shadow-red-900/50`}
                title={sidebarCollapsed ? "Risk Profiles" : undefined}
              >
                <Shield className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Risk Profiles</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                data-testid="tab-reports"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 dark:data-[state=active]:shadow-indigo-900/50`}
                title={sidebarCollapsed ? "Reports" : undefined}
              >
                <FileText className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Reports</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="guidance" 
                data-testid="tab-guidance"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-200 dark:data-[state=active]:shadow-green-900/50`}
                title={sidebarCollapsed ? "Guidance" : undefined}
              >
                <MessageSquare className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Guidance</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="partners" 
                data-testid="tab-partners"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-200 dark:data-[state=active]:shadow-cyan-900/50`}
                title={sidebarCollapsed ? "Partners" : undefined}
              >
                <Building2 className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Partners</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                data-testid="tab-agents"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-200 dark:data-[state=active]:shadow-amber-900/50`}
                title={sidebarCollapsed ? "Agents" : undefined}
              >
                <Users className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Agents</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="marketing" 
                data-testid="tab-marketing"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-200 dark:data-[state=active]:shadow-pink-900/50`}
                title={sidebarCollapsed ? "Marketing" : undefined}
              >
                <Megaphone className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Marketing</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="partner-management" 
                data-testid="tab-partner-management"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-200 dark:data-[state=active]:shadow-indigo-900/50`}
                title={sidebarCollapsed ? "Partner Management" : undefined}
              >
                <Handshake className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Partner Management</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="client-agent-relationships" 
                data-testid="tab-client-agent-relationships"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-200 dark:data-[state=active]:shadow-purple-900/50`}
                title={sidebarCollapsed ? "EUIN/ARN Integration" : undefined}
              >
                <Network className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">EUIN/ARN Integration</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="communications" 
                data-testid="tab-communications"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-200 dark:data-[state=active]:shadow-green-900/50`}
                title={sidebarCollapsed ? "Communications" : undefined}
              >
                <MessageCircle className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Communications</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="supplier-dashboard" 
                data-testid="tab-supplier-dashboard"
                className={`w-full ${sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'} py-3 rounded-xl transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-200 dark:data-[state=active]:shadow-orange-900/50`}
                title={sidebarCollapsed ? "Suppliers" : undefined}
              >
                <Building2 className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                {!sidebarCollapsed && <span className="font-medium">Supplier Dashboard</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Enhanced Main Content Area */}
          <div className="flex-1 overflow-auto p-8 bg-gradient-to-br from-white/60 via-slate-50/80 to-blue-50/60 dark:from-slate-900/60 dark:via-slate-800/80 dark:to-slate-900/60">

            {/* Enhanced Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-8">
              {/* Enhanced Header Section */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Admin Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400">Monitor your platform's performance and manage operations</p>
              </div>
              
              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <Card data-testid="card-total-users" className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-2xl border-0 hover:shadow-3xl hover:shadow-blue-500/40 transition-all duration-500 hover:-translate-y-2 hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <div>
                      <CardTitle className="text-sm font-semibold text-blue-100 uppercase tracking-wider">Total Clients</CardTitle>
                      <p className="text-xs text-blue-200 mt-1">Active users</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-4xl font-bold mb-3" data-testid="text-total-clients">
                      {(dashboardData as any)?.totalClients?.toLocaleString() || '0'}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-100 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +{(dashboardData as any)?.newClientsToday || 0} today
                      </p>
                      <div className="text-xs text-blue-200">
                        {(dashboardData as any)?.clientGrowthPercent || 0}% growth
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-active-users" className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-green-600 to-emerald-700 text-white shadow-2xl border-0 hover:shadow-3xl hover:shadow-emerald-500/40 transition-all duration-500 hover:-translate-y-2 hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <div>
                      <CardTitle className="text-sm font-semibold text-emerald-100 uppercase tracking-wider">Active Clients</CardTitle>
                      <p className="text-xs text-emerald-200 mt-1">Online now</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-4xl font-bold mb-3" data-testid="text-active-clients">
                      {(dashboardData as any)?.activeClients?.toLocaleString() || '0'}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-emerald-100 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Last 24 hours
                      </p>
                      <div className="h-2 w-16 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white/60 rounded-full" style={{width: `${Math.min(((dashboardData as any)?.activeClients / (dashboardData as any)?.totalClients) * 100 || 0, 100)}%`}}></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-total-logins" className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-indigo-600 to-purple-700 text-white shadow-2xl border-0 hover:shadow-3xl hover:shadow-purple-500/40 transition-all duration-500 hover:-translate-y-2 hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <div>
                      <CardTitle className="text-sm font-semibold text-purple-100 uppercase tracking-wider">Total Logins</CardTitle>
                      <p className="text-xs text-purple-200 mt-1">This month</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-4xl font-bold mb-3" data-testid="text-total-logins">
                      {(dashboardData as any)?.totalLogins?.toLocaleString() || '0'}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-purple-100 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        +{(dashboardData as any)?.loginsToday || 0} today
                      </p>
                      <div className="text-xs text-purple-200">
                        Peak: {(dashboardData as any)?.peakLogins || 0}/day
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-avg-session" className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-600 to-orange-700 text-white shadow-2xl border-0 hover:shadow-3xl hover:shadow-orange-500/40 transition-all duration-500 hover:-translate-y-2 hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                    <div>
                      <CardTitle className="text-sm font-semibold text-orange-100 uppercase tracking-wider">Avg Session</CardTitle>
                      <p className="text-xs text-orange-200 mt-1">Duration</p>
                    </div>
                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-colors duration-300">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-4xl font-bold mb-3" data-testid="text-avg-session">
                      {(dashboardData as any)?.avgSessionTime || 0}m
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-orange-100 flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        Per user
                      </p>
                      <div className="text-xs text-orange-200">
                        Best: {(dashboardData as any)?.bestSessionTime || 0}m
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Enhanced Data Visualization Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card data-testid="card-activity-metrics" className="group relative overflow-hidden bg-gradient-to-br from-white via-blue-50/50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 border-2 border-blue-200/30 dark:border-slate-600 shadow-2xl hover:shadow-3xl hover:shadow-blue-500/20 transition-all duration-500 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="pb-6 relative z-10">
                    <div className="flex items-center space-x-4">
                      <div className="p-4 bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                        <Activity className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Activity Metrics</CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400 text-sm">Real-time performance indicators</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 relative z-10">
                    <div className="flex justify-between items-center p-5 bg-gradient-to-r from-blue-50/80 via-cyan-50/80 to-blue-50/80 dark:from-slate-700/50 dark:via-slate-600/50 dark:to-slate-700/50 rounded-2xl border border-blue-100/50 dark:border-slate-600/50 hover:border-blue-300/50 transition-all duration-300">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                          <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Page Views</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-page-views">
                          {activityMetrics?.pageViews?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">+12% today</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-5 bg-gradient-to-r from-emerald-50/80 via-green-50/80 to-emerald-50/80 dark:from-slate-700/50 dark:via-slate-600/50 dark:to-slate-700/50 rounded-2xl border border-emerald-100/50 dark:border-slate-600/50 hover:border-emerald-300/50 transition-all duration-300">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                          <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">API Calls</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-api-calls">
                          {activityMetrics?.apiCalls?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">+8% today</div>
                      </div>
                    </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Portfolio Views</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600" data-testid="text-portfolio-views">
                    {activityMetrics?.portfolioViews || 0}
                  </span>
                </div>
                    <div className="flex justify-between items-center p-5 bg-gradient-to-r from-orange-50/80 via-red-50/80 to-orange-50/80 dark:from-slate-700/50 dark:via-slate-600/50 dark:to-slate-700/50 rounded-2xl border border-orange-100/50 dark:border-slate-600/50 hover:border-orange-300/50 transition-all duration-300">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                          <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Trades</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-trades">
                          {activityMetrics?.trades?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">+5% today</div>
                      </div>
                    </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health" className="bg-gradient-to-br from-white to-emerald-50 dark:from-slate-800 dark:to-slate-900 border-2 border-emerald-100 dark:border-slate-700 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">System Health</CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-300">Real-time status monitoring</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Uptime</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-600" data-testid="text-uptime">
                    {dashboardInsights?.systemHealth?.uptime || "0h 0m"}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Error Rate</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600" data-testid="text-error-rate">
                    {dashboardInsights?.systemHealth?.errorRate || 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Response Time</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600" data-testid="text-response-time">
                    {dashboardInsights?.systemHealth?.responseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Status</span>
                  </div>
                  <Badge variant="secondary" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 px-4 py-2 text-sm font-medium" data-testid="badge-system-status">
                    ✓ Healthy
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comprehensive User Management Tab */}
        <TabsContent value="comprehensive-users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Total User Statistics */}
            <Card data-testid="card-user-overview">
              <CardHeader>
                <CardTitle>User Overview</CardTitle>
                <CardDescription>Platform-wide user statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Users</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-users">1,248</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Users</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-users">1,156</Badge>
                </div>
                <div className="flex justify-between">
                  <span>New Today</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-new-users-today">23</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Verified Users</span>
                  <Badge className="bg-purple-100 text-purple-800" data-testid="badge-verified-users">892</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Role Distribution */}
            <Card data-testid="card-role-distribution">
              <CardHeader>
                <CardTitle>User Roles</CardTitle>
                <CardDescription>Distribution by role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Clients</span>
                  <Badge className="bg-blue-100 text-blue-800">1,024</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Partners</span>
                  <Badge className="bg-green-100 text-green-800">185</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Suppliers</span>
                  <Badge className="bg-yellow-100 text-yellow-800">32</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Agents</span>
                  <Badge className="bg-purple-100 text-purple-800">15</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Admins</span>
                  <Badge className="bg-red-100 text-red-800">3</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Activity Metrics */}
            <Card data-testid="card-activity-metrics">
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>User engagement data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Daily Active</span>
                  <Badge className="bg-green-100 text-green-800">458</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Weekly Active</span>
                  <Badge className="bg-blue-100 text-blue-800">823</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Monthly Active</span>
                  <Badge className="bg-purple-100 text-purple-800">1,156</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Avg Session</span>
                  <Badge className="bg-yellow-100 text-yellow-800">24m</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="card-user-quick-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>User management tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-add-user">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-operations">
                  <Users className="w-4 h-4 mr-2" />
                  Bulk Operations
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-export-users">
                  <Download className="w-4 h-4 mr-2" />
                  Export Users
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-user-analytics">
                  <BarChart className="w-4 h-4 mr-2" />
                  User Analytics
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Filters */}
          <Card data-testid="card-user-filters">
            <CardHeader>
              <CardTitle>Advanced Filters</CardTitle>
              <CardDescription>Filter and search all platform users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Users</label>
                  <Input placeholder="Name, email, or ID..." data-testid="input-user-search" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select data-testid="select-user-role">
                    <SelectTrigger>
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="client">Clients</SelectItem>
                      <SelectItem value="partner">Partners</SelectItem>
                      <SelectItem value="supplier">Suppliers</SelectItem>
                      <SelectItem value="agent">Agents</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select data-testid="select-user-status">
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Registration Date</label>
                  <Select data-testid="select-registration-date">
                    <SelectTrigger>
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button data-testid="button-apply-filters">Apply Filters</Button>
                <Button variant="outline" data-testid="button-clear-filters">Clear All</Button>
                <Button variant="outline" data-testid="button-save-filter">Save Filter</Button>
              </div>
            </CardContent>
          </Card>

          {/* Comprehensive User Management Table */}
          <Card data-testid="card-comprehensive-users-table">
            <CardHeader>
              <CardTitle>All Platform Users</CardTitle>
              <CardDescription>Comprehensive user management with advanced controls</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Details</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Portfolio Value</TableHead>
                    <TableHead>Risk Profile</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="user-row-1">
                    <TableCell>
                      <div>
                        <div className="font-medium">Rajesh Kumar</div>
                        <div className="text-sm text-muted-foreground">rajesh.kumar@gmail.com</div>
                        <div className="text-xs text-muted-foreground">ID: USR001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800" data-testid="badge-role-1">Client</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-1">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-1">Nov 15, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-1">2h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-1">₹12,50,000</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-risk-1">Moderate</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-1">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-1">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-1">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-user-1">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-2">
                    <TableCell>
                      <div>
                        <div className="font-medium">TechCorp Solutions</div>
                        <div className="text-sm text-muted-foreground">contact@techcorp.com</div>
                        <div className="text-xs text-muted-foreground">ID: PTR001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-role-2">Partner</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-2">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-2">Oct 28, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-2">1h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-2">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-2">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-2">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-2">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-2">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-manage-user-2">
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-3">
                    <TableCell>
                      <div>
                        <div className="font-medium">Priya Sharma</div>
                        <div className="text-sm text-muted-foreground">priya.sharma@email.com</div>
                        <div className="text-xs text-muted-foreground">ID: USR123</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800" data-testid="badge-role-3">Client</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-status-3">Pending</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-3">Dec 1, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-3">5h ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-3">₹0</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-3">Not Set</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-kyc-3">Pending</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-3">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-approve-user-3">
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-reject-user-3">
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-4">
                    <TableCell>
                      <div>
                        <div className="font-medium">DataFlow Suppliers</div>
                        <div className="text-sm text-muted-foreground">admin@dataflow.in</div>
                        <div className="text-xs text-muted-foreground">ID: SUP005</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-800" data-testid="badge-role-4">Supplier</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-4">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-4">Sep 12, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-4">3d ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-4">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-4">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-4">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-4">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-4">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-contract-user-4">
                          Contract
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow data-testid="user-row-5">
                    <TableCell>
                      <div>
                        <div className="font-medium">Sarah Johnson</div>
                        <div className="text-sm text-muted-foreground">sarah.j@fintekpro.com</div>
                        <div className="text-xs text-muted-foreground">ID: AGT001</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-orange-100 text-orange-800" data-testid="badge-role-5">Agent</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-status-5">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-registration-5">Aug 5, 2024</TableCell>
                    <TableCell data-testid="text-last-activity-5">30m ago</TableCell>
                    <TableCell data-testid="text-portfolio-value-5">N/A</TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-risk-5">N/A</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-kyc-5">Verified</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" data-testid="button-view-user-5">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-user-5">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-schedule-user-5">
                          Schedule
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="clients" className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-clients"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
            </div>
            
            {/* Add Client Button */}
            <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-add-client">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <Card data-testid="card-users-table">
            <CardHeader>
              <CardTitle>Clients Management</CardTitle>
              <CardDescription>
                Manage client roles and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData?.users?.map((client: Client) => (
                      <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-clientname-${client.id}`}>
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${client.id}`}>
                              {client.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={client.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ clientId: client.id, role })}
                            data-testid={`select-role-${client.id}`}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">Client</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.isActive ? "secondary" : "destructive"} data-testid={`badge-status-${client.id}`}>
                            {client.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-last-login-${client.id}`}>
                          {client.lastLoginAt 
                            ? format(new Date(client.lastLoginAt), "MMM d, yyyy")
                            : "Never"
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={client.isActive ? "destructive" : "secondary"}
                              onClick={() => updateStatusMutation.mutate({ 
                                clientId: client.id, 
                                isActive: !client.isActive 
                              })}
                              data-testid={`button-toggle-status-${client.id}`}
                            >
                              {client.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setClientForm({
                                  firstName: client.firstName,
                                  lastName: client.lastName,
                                  email: client.email,
                                  mobile: client.mobile,
                                  role: client.role,
                                  isActive: client.isActive
                                });
                                setEditClientDialog(true);
                              }}
                              data-testid={`button-edit-client-${client.id}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedClient(client);
                                setGuidanceDialog(true);
                              }}
                              data-testid={`button-send-guidance-${client.id}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setClientToDelete(client);
                                setDeleteClientDialog(true);
                              }}
                              data-testid={`button-delete-client-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card data-testid="card-recent-activities">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Live activity feed from all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((activities as any) || []).slice(0, 20).map((activity: ClientActivity, index: number) => (
                  <div key={activity.id || index} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`activity-${index}`}>
                    <Activity className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-activity-action-${index}`}>
                          {activity.action?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {activity.resource && (
                          <Badge variant="outline" data-testid={`badge-activity-resource-${index}`}>
                            {activity.resource}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-activity-details-${index}`}>
                        User: {activity.userId} • {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CKYC Management Tab */}
        <TabsContent value="ckyc" className="space-y-6">
          <CkycManagement />
        </TabsContent>

        {/* API Status Tab */}
        <TabsContent value="api-status" className="space-y-6">
          <ApiStatusPanel />
        </TabsContent>

        {/* AI Error Monitoring Tab */}
        <TabsContent value="error-monitoring" className="space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="w-6 h-6 text-purple-600" />
                  Gemini AI Error Monitor
                </h2>
                <p className="text-gray-600">AI-powered system analysis and automated optimization</p>
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  System Health Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">✓</div>
                    <div className="text-sm text-green-700">APIs Running</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">AI</div>
                    <div className="text-sm text-blue-700">Monitoring Active</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">0</div>
                    <div className="text-sm text-purple-700">Critical Errors</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Available Endpoints</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/health</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/errors/analysis</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/replit-agent/instructions</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-mono text-sm">/api/system/auto-heal</span>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Gemini AI Integration Status</h4>
                  <p className="text-blue-700 text-sm">✅ Error monitoring system is active and functional</p>
                  <p className="text-blue-700 text-sm">✅ AI-powered analysis endpoints are operational</p>
                  <p className="text-blue-700 text-sm">✅ Replit Agent instructions system ready</p>
                  <p className="text-blue-700 text-sm">✅ Auto-healing recommendations available</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="card-user-engagement">
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Active users breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Daily Active</span>
                  <span className="font-bold" data-testid="text-daily-active">
                    {(insights as any)?.userEngagement?.dailyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Active</span>
                  <span className="font-bold" data-testid="text-weekly-active">
                    {(insights as any)?.userEngagement?.weeklyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Active</span>
                  <span className="font-bold" data-testid="text-monthly-active">
                    {(insights as any)?.userEngagement?.monthlyActiveUsers || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-popular-features">
              <CardHeader>
                <CardTitle>Popular Features</CardTitle>
                <CardDescription>Most used features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.popularFeatures || []).slice(0, 5).map((feature: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`popular-feature-${index}`}>
                    <span className="text-sm">{feature.feature}</span>
                    <span className="font-bold">{feature.usage}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-user-growth">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.userGrowth || []).slice(-7).map((growth: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`user-growth-${index}`}>
                    <span className="text-sm">{format(new Date(growth.date), "MMM d")}</span>
                    <span className="font-bold">+{growth.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="space-y-6">
          <Card data-testid="card-guidance-tools">
            <CardHeader>
              <CardTitle>User Guidance Tools</CardTitle>
              <CardDescription>
                Send personalized guidance and notifications to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a user from the Users tab to send personalized guidance messages.
                Messages can include tips, alerts, or actionable recommendations.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Profiling Tab */}
        <TabsContent value="risk-profiling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Profile Viewer */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Customer Risk Profiles
                  </CardTitle>
                  <CardDescription>
                    View and manage customer investment risk assessments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskProfileViewer />
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    New Risk Assessment
                  </CardTitle>
                  <CardDescription>
                    Conduct risk assessment for new or existing customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskAssessmentForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Tabs defaultValue="capital-gains" className="w-full">
            <TabsList>
              <TabsTrigger value="capital-gains">Capital Gains Reports</TabsTrigger>
              <TabsTrigger value="transaction-reports">Transaction Reports</TabsTrigger>
            </TabsList>
            
            <TabsContent value="capital-gains">
              <CapitalGainsReportViewer />
            </TabsContent>
            
            <TabsContent value="transaction-reports">
              <TransactionReportViewer />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Partner Statistics */}
            <Card data-testid="card-partner-stats">
              <CardHeader>
                <CardTitle>Partner Overview</CardTitle>
                <CardDescription>Vendor partner statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Partners</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-partners">125</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Partners</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-partners">98</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Pending Approval</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-pending-partners">12</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Suspended</span>
                  <Badge className="bg-red-100 text-red-800" data-testid="badge-suspended-partners">15</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Partner Actions */}
            <Card data-testid="card-partner-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage partner operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" data-testid="button-invite-partner">
                  <Building2 className="w-4 h-4 mr-2" />
                  Invite New Partner
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-approve">
                  <Shield className="w-4 h-4 mr-2" />
                  Bulk Approve
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-export-partners">
                  <FileText className="w-4 h-4 mr-2" />
                  Export Partner List
                </Button>
              </CardContent>
            </Card>

            {/* Recent Partner Activity */}
            <Card data-testid="card-partner-activity">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest partner actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-0">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">TechCorp Solutions</div>
                      <div className="text-xs text-muted-foreground">Status changed to Active</div>
                    </div>
                    <div className="text-xs text-muted-foreground">2 hours ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">FinServe Partners</div>
                      <div className="text-xs text-muted-foreground">Submitted application</div>
                    </div>
                    <div className="text-xs text-muted-foreground">1 day ago</div>
                  </div>
                  <div className="flex items-center gap-3 p-2 border rounded" data-testid="partner-activity-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Global Investments</div>
                      <div className="text-xs text-muted-foreground">Updated profile</div>
                    </div>
                    <div className="text-xs text-muted-foreground">3 days ago</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Partner Management Table */}
          <Card data-testid="card-partner-management">
            <CardHeader>
              <CardTitle>Partner Management</CardTitle>
              <CardDescription>Manage all vendor partners</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search partners..."
                    className="w-full"
                    data-testid="input-search-partners"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-status">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Partners</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending Approval</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-48" data-testid="select-partner-type">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="advisor">Financial Advisor</SelectItem>
                    <SelectItem value="fintech">FinTech</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Partners Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partner Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead>Revenue Share</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="partner-row-1">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          TC
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-1">TechCorp Solutions</div>
                          <div className="text-sm text-muted-foreground">contact@techcorp.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-1">FinTech</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-1">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-1">Dec 15, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-1">15%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-1">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-1">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-1">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-2">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          FS
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-2">FinServe Partners</div>
                          <div className="text-sm text-muted-foreground">admin@finserve.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-2">Advisor</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-partner-status-2">Pending</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-2">Jan 8, 2025</TableCell>
                    <TableCell data-testid="text-partner-revenue-2">12%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-2">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-approve-partner-2">
                          Approve
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-reject-partner-2">
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-3">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          GI
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-3">Global Investments</div>
                          <div className="text-sm text-muted-foreground">info@globalinvest.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-3">Broker</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800" data-testid="badge-partner-status-3">Active</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-3">Nov 22, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-3">18%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-3">
                          View
                        </Button>
                        <Button variant="outline" size="sm" data-testid="button-edit-partner-3">
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-suspend-partner-3">
                          Suspend
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow data-testid="partner-row-4">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          WM
                        </div>
                        <div>
                          <div className="font-medium" data-testid="text-partner-name-4">InvestSmart Co</div>
                          <div className="text-sm text-muted-foreground">contact@wealthmgmt.com</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid="badge-partner-type-4">Bank</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800" data-testid="badge-partner-status-4">Suspended</Badge>
                    </TableCell>
                    <TableCell data-testid="text-partner-joined-4">Oct 5, 2024</TableCell>
                    <TableCell data-testid="text-partner-revenue-4">20%</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid="button-view-partner-4">
                          View
                        </Button>
                        <Button size="sm" data-testid="button-reactivate-partner-4">
                          Reactivate
                        </Button>
                        <Button variant="destructive" size="sm" data-testid="button-terminate-partner-4">
                          Terminate
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent Statistics */}
            <Card data-testid="card-agent-stats">
              <CardHeader>
                <CardTitle>Agent Overview</CardTitle>
                <CardDescription>Customer care agent statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Agents</span>
                  <Badge className="bg-blue-100 text-blue-800" data-testid="badge-total-agents">
                    {agentsLoading ? "..." : agentsData.length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Active Agents</span>
                  <Badge className="bg-green-100 text-green-800" data-testid="badge-active-agents">
                    {agentsLoading ? "..." : agentsData.filter((agent: any) => agent.status === 'active').length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>On Leave</span>
                  <Badge className="bg-yellow-100 text-yellow-800" data-testid="badge-leave-agents">
                    {agentsLoading ? "..." : agentsData.filter((agent: any) => agent.status === 'on_leave').length}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>With EUIN</span>
                  <Badge className="bg-purple-100 text-purple-800" data-testid="badge-euin-agents">
                    {agentsLoading ? "..." : agentsData.filter((agent: any) => agent.euinNumber).length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card data-testid="card-agent-actions">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage agents efficiently</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => setShowAddAgentDialog(true)} data-testid="button-add-agent">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add New Agent
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-bulk-assign">
                  <Building2 className="w-4 h-4 mr-2" />
                  Bulk Partner Assignment
                </Button>
                <Button variant="outline" className="w-full" data-testid="button-performance-report">
                  <FileText className="w-4 h-4 mr-2" />
                  Performance Report
                </Button>
              </CardContent>
            </Card>

            {/* Recent Performance */}
            <Card data-testid="card-agent-performance">
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription>This month's best agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {agentsLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    <div className="mt-2 text-sm text-muted-foreground">Loading top agents...</div>
                  </div>
                ) : agentsData.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No agents found
                  </div>
                ) : (
                  agentsData
                    .filter((agent: any) => agent.status === 'active')
                    .sort((a: any, b: any) => (b.customerSatisfactionRating || 0) - (a.customerSatisfactionRating || 0))
                    .slice(0, 3)
                    .map((agent: any) => (
                      <div key={agent.id} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{agent.fullName}</div>
                          <div className="text-sm text-muted-foreground">{agent.totalTicketsHandled || 0} tickets resolved</div>
                        </div>
                        <Badge className="bg-green-100 text-green-800">{agent.customerSatisfactionRating || 'N/A'}★</Badge>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Agents Management Table */}
          <Card data-testid="card-agents-table">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Agents</CardTitle>
                  <CardDescription>Manage agents with EUIN/ARN number assignments</CardDescription>
                </div>
                <Button onClick={() => setShowAddAgentDialog(true)} size="sm" data-testid="button-add-agent">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>EUIN Number</TableHead>
                    <TableHead>ARN Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Partner/Client Counts</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentsLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <div className="mt-2">Loading agents...</div>
                      </TableCell>
                    </TableRow>
                  ) : agentsData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                        No agents found
                        <div className="mt-2">
                          <Button onClick={() => setShowAddAgentDialog(true)} variant="outline" size="sm">
                            Add First Agent
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentsData.map((agent: any, index: number) => (
                      <TableRow key={agent.id} data-testid={`agent-row-${index + 1}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{agent.fullName}</div>
                            <div className="text-sm text-muted-foreground">{agent.email}</div>
                            <div className="text-xs text-muted-foreground">{agent.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-employee-id-${index + 1}`}>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {agent.employeeId || 'N/A'}
                          </code>
                        </TableCell>
                        <TableCell>
                          {agent.euinNumber ? (
                            <code className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                              {agent.euinNumber}
                            </code>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.arnCode ? (
                            <code className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-green-800 dark:text-green-200">
                              {agent.arnCode}
                            </code>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              agent.status === 'active' ? 'bg-green-100 text-green-800' : 
                              agent.status === 'on_leave' ? 'bg-yellow-100 text-yellow-800' : 
                              'bg-red-100 text-red-800'
                            } 
                            data-testid={`badge-status-${index + 1}`}
                          >
                            {agent.status === 'active' ? 'Active' : agent.status === 'on_leave' ? 'On Leave' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {agent.specializations && agent.specializations.map((spec: string, idx: number) => (
                              <Badge key={idx} className={`${spec === 'technical' ? 'bg-blue-100 text-blue-800' : spec === 'billing' ? 'bg-purple-100 text-purple-800' : spec === 'compliance' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                                {spec.charAt(0).toUpperCase() + spec.slice(1).replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell data-testid={`text-mapping-counts-${index + 1}`}>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                {agent.partnerCount || 0} Partners
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                {agent.clientCount || 0} Clients
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Rating: <span className="font-medium">{agent.customerSatisfactionRating || 'N/A'}★</span></div>
                            <div>Tickets: <span className="font-medium">{agent.totalTicketsHandled || 0}</span></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditAgent(agent)}
                              data-testid={`button-edit-agent-${index + 1}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDeleteAgent(agent)}
                              data-testid={`button-delete-agent-${index + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Marketing Tools Tab */}
        <TabsContent value="marketing" className="space-y-6">
          <MarketingToolsPanel />
        </TabsContent>

      {/* Agent Management Dialogs */}
      {/* Add Agent Dialog */}
      <Dialog open={showAddAgentDialog} onOpenChange={setShowAddAgentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
            <DialogDescription>Create a new agent with EUIN/ARN assignments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={agentForm.fullName}
                onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-agent-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={agentForm.email}
                onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                placeholder="Enter email"
                data-testid="input-agent-email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={agentForm.phone}
                onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                placeholder="Enter phone number"
                data-testid="input-agent-phone"
              />
            </div>
            <div>
              <Label>Employee ID</Label>
              <Input
                value={agentForm.employeeId}
                onChange={(e) => setAgentForm({ ...agentForm, employeeId: e.target.value })}
                placeholder="Enter employee ID"
                data-testid="input-agent-employee-id"
              />
            </div>
            <div>
              <Label>EUIN Number</Label>
              <Input
                value={agentForm.euinNumber}
                onChange={(e) => setAgentForm({ ...agentForm, euinNumber: e.target.value })}
                placeholder="Enter EUIN number"
                data-testid="input-agent-euin"
              />
            </div>
            <div>
              <Label>ARN Code</Label>
              <Input
                value={agentForm.arnCode}
                onChange={(e) => setAgentForm({ ...agentForm, arnCode: e.target.value })}
                placeholder="Enter ARN code"
                data-testid="input-agent-arn"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={agentForm.status} onValueChange={(value) => setAgentForm({ ...agentForm, status: value })}>
                <SelectTrigger data-testid="select-agent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddAgentDialog(false)} data-testid="button-cancel-add-agent">
              Cancel
            </Button>
            <Button onClick={handleCreateAgent} disabled={createAgentMutation.isPending} data-testid="button-create-agent">
              {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Dialog */}
      <Dialog open={showEditAgentDialog} onOpenChange={setShowEditAgentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>Update agent information and EUIN/ARN assignments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={agentForm.fullName}
                onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })}
                placeholder="Enter full name"
                data-testid="input-edit-agent-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={agentForm.email}
                onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                placeholder="Enter email"
                data-testid="input-edit-agent-email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={agentForm.phone}
                onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                placeholder="Enter phone number"
                data-testid="input-edit-agent-phone"
              />
            </div>
            <div>
              <Label>Employee ID</Label>
              <Input
                value={agentForm.employeeId}
                onChange={(e) => setAgentForm({ ...agentForm, employeeId: e.target.value })}
                placeholder="Enter employee ID"
                data-testid="input-edit-agent-employee-id"
              />
            </div>
            <div>
              <Label>EUIN Number</Label>
              <Input
                value={agentForm.euinNumber}
                onChange={(e) => setAgentForm({ ...agentForm, euinNumber: e.target.value })}
                placeholder="Enter EUIN number"
                data-testid="input-edit-agent-euin"
              />
            </div>
            <div>
              <Label>ARN Code</Label>
              <Input
                value={agentForm.arnCode}
                onChange={(e) => setAgentForm({ ...agentForm, arnCode: e.target.value })}
                placeholder="Enter ARN code"
                data-testid="input-edit-agent-arn"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={agentForm.status} onValueChange={(value) => setAgentForm({ ...agentForm, status: value })}>
                <SelectTrigger data-testid="select-edit-agent-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowEditAgentDialog(false)} data-testid="button-cancel-edit-agent">
              Cancel
            </Button>
            <Button onClick={handleUpdateAgent} disabled={updateAgentMutation.isPending} data-testid="button-update-agent">
              {updateAgentMutation.isPending ? "Updating..." : "Update Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Dialog */}
      <Dialog open={showDeleteAgentDialog} onOpenChange={setShowDeleteAgentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete agent {selectedAgent?.fullName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteAgentDialog(false)} data-testid="button-cancel-delete-agent">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteAgent} disabled={deleteAgentMutation.isPending} data-testid="button-confirm-delete-agent">
              {deleteAgentMutation.isPending ? "Deleting..." : "Delete Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guidance Dialog */}
      <Dialog open={guidanceDialog} onOpenChange={setGuidanceDialog}>
        <DialogContent data-testid="dialog-send-guidance">
          <DialogHeader>
            <DialogTitle>Send Guidance</DialogTitle>
            <DialogDescription>
              Send personalized guidance to {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={guidanceForm.title}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, title: e.target.value })}
                placeholder="Enter guidance title"
                data-testid="input-guidance-title"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={guidanceForm.message}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, message: e.target.value })}
                placeholder="Enter your guidance message"
                rows={4}
                data-testid="textarea-guidance-message"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={guidanceForm.type}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, type: value })}
                >
                  <SelectTrigger data-testid="select-guidance-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="guidance">Guidance</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={guidanceForm.priority}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-guidance-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="actionUrl">Action URL (Optional)</Label>
              <Input
                id="actionUrl"
                value={guidanceForm.actionUrl}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, actionUrl: e.target.value })}
                placeholder="https://example.com/action"
                data-testid="input-guidance-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuidanceDialog(false)} data-testid="button-cancel-guidance">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && guidanceForm.title && guidanceForm.message) {
                  sendGuidanceMutation.mutate({
                    clientId: selectedClient.id,
                    guidance: guidanceForm
                  });
                }
              }}
              disabled={!guidanceForm.title || !guidanceForm.message || sendGuidanceMutation.isPending}
              data-testid="button-send-guidance"
            >
              {sendGuidanceMutation.isPending ? "Sending..." : "Send Guidance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Dialog */}
      <Dialog open={createClientDialog} onOpenChange={setCreateClientDialog}>
        <DialogContent data-testid="dialog-create-client">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            Create a new client account with basic information
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={clientForm.firstName}
                onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                placeholder="John"
                data-testid="input-first-name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={clientForm.lastName}
                onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                placeholder="Doe"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
              placeholder="john.doe@example.com"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              value={clientForm.mobile}
              onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
              placeholder="+1 (555) 123-4567"
              data-testid="input-mobile"
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
              <SelectTrigger data-testid="select-role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Client</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={clientForm.isActive}
              onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
              data-testid="checkbox-active"
            />
            <Label htmlFor="isActive">Active Account</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreateClientDialog(false)} data-testid="button-cancel-create">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (clientForm.firstName && clientForm.lastName && clientForm.email) {
                createClientMutation.mutate(clientForm);
              }
            }}
            disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || createClientMutation.isPending}
            data-testid="button-create-client"
          >
            {createClientMutation.isPending ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientDialog} onOpenChange={setEditClientDialog}>
        <DialogContent data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information for {selectedClient?.firstName} {selectedClient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={clientForm.firstName}
                  onChange={(e) => setClientForm({ ...clientForm, firstName: e.target.value })}
                  placeholder="John"
                  data-testid="input-edit-first-name"
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={clientForm.lastName}
                  onChange={(e) => setClientForm({ ...clientForm, lastName: e.target.value })}
                  placeholder="Doe"
                  data-testid="input-edit-last-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                placeholder="john.doe@example.com"
                data-testid="input-edit-email"
              />
            </div>
            <div>
              <Label htmlFor="editMobile">Mobile Number</Label>
              <Input
                id="editMobile"
                value={clientForm.mobile}
                onChange={(e) => setClientForm({ ...clientForm, mobile: e.target.value })}
                placeholder="+1 (555) 123-4567"
                data-testid="input-edit-mobile"
              />
            </div>
            <div>
              <Label htmlFor="editRole">Role</Label>
              <Select value={clientForm.role} onValueChange={(value) => setClientForm({ ...clientForm, role: value })}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={clientForm.isActive}
                onChange={(e) => setClientForm({ ...clientForm, isActive: e.target.checked })}
                data-testid="checkbox-edit-active"
              />
              <Label htmlFor="editIsActive">Active Account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientDialog(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient && clientForm.firstName && clientForm.lastName && clientForm.email) {
                  updateClientMutation.mutate({
                    clientId: selectedClient.id,
                    clientData: clientForm
                  });
                }
              }}
              disabled={!clientForm.firstName || !clientForm.lastName || !clientForm.email || updateClientMutation.isPending}
              data-testid="button-update-client"
            >
              {updateClientMutation.isPending ? "Updating..." : "Update Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={deleteClientDialog} onOpenChange={setDeleteClientDialog}>
        <DialogContent data-testid="dialog-delete-client">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {clientToDelete?.firstName} {clientToDelete?.lastName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-sm font-medium text-red-800">Warning: This will permanently delete the client account</span>
            </div>
            <div className="mt-2 text-sm text-red-700">
              • All client data will be permanently removed
              • Portfolio and transaction history will be lost
              • This action cannot be undone
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClientDialog(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          {/* Partner Management Tab */}
          <TabsContent value="partner-management" className="space-y-6" data-testid="partner-management-content">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Partner Management</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Manage partner relationships and agent assignments</p>
              </div>
              <Button className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:from-indigo-600 hover:to-blue-700" data-testid="button-add-partner">
                <Building className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Partner Overview Cards */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="group relative overflow-hidden bg-gradient-to-br from-white via-blue-50/50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 border-2 border-blue-200/30 dark:border-slate-600 shadow-2xl hover:shadow-3xl hover:shadow-blue-500/20 transition-all duration-500 hover:-translate-y-1">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <CardHeader className="pb-6 relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-4 bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                          <Handshake className="h-7 w-7 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Partner Network</CardTitle>
                          <CardDescription className="text-slate-600 dark:text-slate-400 text-sm">Active partnerships and agent assignments</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 relative z-10">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-blue-100/50 dark:border-slate-600/50">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">24</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Active Partners</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-r from-emerald-50/80 to-green-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-emerald-100/50 dark:border-slate-600/50">
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">156</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Assigned Agents</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-purple-100/50 dark:border-slate-600/50">
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">2,847</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">Total Clients</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Partner List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-indigo-600" />
                      Partner Directory
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { name: "TechCorp Solutions", agents: 12, clients: 342, status: "active", tier: "platinum" },
                        { name: "FinanceFirst Partners", agents: 8, clients: 156, status: "active", tier: "gold" },
                        { name: "Global Investment Group", agents: 15, clients: 423, status: "active", tier: "platinum" },
                        { name: "Regional Wealth Advisors", agents: 6, clients: 89, status: "pending", tier: "silver" }
                      ].map((partner, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
                              <Building className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800 dark:text-white">{partner.name}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400">{partner.agents} agents • {partner.clients} clients</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={`${partner.tier === 'platinum' ? 'bg-purple-100 text-purple-800' : 
                              partner.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                              {partner.tier}
                            </Badge>
                            <Badge className={`${partner.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                              {partner.status}
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Agent Assignment Panel */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
                      Agent Assignments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-800 dark:text-white">Agent Sarah Johnson</span>
                          <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">TechCorp Solutions • 28 clients</p>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-800 dark:text-white">Agent Mike Chen</span>
                          <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">FinanceFirst Partners • 19 clients</p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-slate-800 dark:text-white">Agent Lisa Wong</span>
                          <Badge className="bg-purple-100 text-purple-800">Active</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Global Investment • 35 clients</p>
                      </div>
                    </div>
                    <Button className="w-full mt-4 bg-gradient-to-r from-emerald-500 to-green-600" size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Assign New Agent
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="w-5 h-5 text-orange-600" />
                      Client Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">High Net Worth</span>
                        <span className="font-semibold text-slate-800 dark:text-white">342</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Retail Investors</span>
                        <span className="font-semibold text-slate-800 dark:text-white">1,856</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600 dark:text-slate-400">Corporate Clients</span>
                        <span className="font-semibold text-slate-800 dark:text-white">649</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="communications" className="space-y-6" data-testid="communications-content">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Communications Center</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Send messages via WhatsApp, SMS, and Email</p>
              </div>
              <div className="flex space-x-2">
                <Button className="bg-gradient-to-r from-green-500 to-emerald-600 text-white" data-testid="button-whatsapp-bulk">
                  <Smartphone className="w-4 h-4 mr-2" />
                  WhatsApp Broadcast
                </Button>
                <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white" data-testid="button-email-campaign">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Campaign
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Communication Stats */}
              <Card className="group relative overflow-hidden bg-gradient-to-br from-white via-green-50/50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 border-2 border-green-200/30 dark:border-slate-600 shadow-2xl hover:shadow-3xl hover:shadow-green-500/20 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardHeader className="pb-6 relative z-10">
                  <div className="flex items-center space-x-4">
                    <div className="p-4 bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300">
                      <MessageCircle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-800 dark:text-white mb-1">Message Analytics</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 text-sm">Last 30 days communication stats</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-green-100/50 dark:border-slate-600/50">
                      <Smartphone className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">1,247</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">WhatsApp</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-blue-100/50 dark:border-slate-600/50">
                      <Mail className="w-6 h-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">856</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">Emails</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-slate-700/50 dark:to-slate-600/50 rounded-xl border border-purple-100/50 dark:border-slate-600/50">
                      <Phone className="w-6 h-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">432</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">SMS</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Message Composer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-600" />
                    Quick Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="message-type">Message Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="recipients">Recipients</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-clients">All Clients</SelectItem>
                        <SelectItem value="partner-agents">Partner Agents</SelectItem>
                        <SelectItem value="high-value">High Value Clients</SelectItem>
                        <SelectItem value="custom">Custom List</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="message-content">Message</Label>
                    <Textarea 
                      placeholder="Type your message here..."
                      className="min-h-24"
                    />
                  </div>
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-cyan-600">
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Communications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  Recent Communications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { 
                      type: "whatsapp", 
                      recipient: "TechCorp Agents (12 recipients)", 
                      message: "Market update: Portfolio rebalancing recommendations...", 
                      time: "2 hours ago",
                      status: "delivered"
                    },
                    { 
                      type: "email", 
                      recipient: "High Value Clients (156 recipients)", 
                      message: "Monthly investment report and performance analysis...", 
                      time: "5 hours ago",
                      status: "sent"
                    },
                    { 
                      type: "sms", 
                      recipient: "Sarah Johnson", 
                      message: "Urgent: Client meeting rescheduled to 3 PM", 
                      time: "1 day ago",
                      status: "delivered"
                    }
                  ].map((comm, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          comm.type === 'whatsapp' ? 'bg-green-100 text-green-600' :
                          comm.type === 'email' ? 'bg-blue-100 text-blue-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          {comm.type === 'whatsapp' ? <Smartphone className="w-5 h-5" /> :
                           comm.type === 'email' ? <Mail className="w-5 h-5" /> :
                           <Phone className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-800 dark:text-white">{comm.recipient}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-96">{comm.message}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">{comm.time}</p>
                        </div>
                      </div>
                      <Badge className={`${comm.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {comm.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client-Agent Relationships Tab */}
          <TabsContent value="client-agent-relationships" className="space-y-6" data-testid="client-agent-relationships-content">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">EUIN/ARN Integration</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Manage client-agent relationships for automated API integration</p>
              </div>
              <Button className="bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700" data-testid="button-add-relationship">
                <Network className="w-4 h-4 mr-2" />
                Add Relationship
              </Button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-green-500 rounded-xl">
                      <UserCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Active Relationships</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {statsLoading ? "..." : (relationshipsStats.activeRelationships || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 border-blue-200 dark:border-blue-700">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Unique Agents</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                        {statsLoading ? "..." : (relationshipsStats.uniqueAgents || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500 rounded-xl">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Auto-Populated APIs</p>
                      <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                        {statsLoading ? "..." : (relationshipsStats.autoPopulatedApis || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client-Agent Relationships Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5" />
                  Client-Agent Relationships
                </CardTitle>
                <CardDescription>
                  Manage EUIN and ARN code associations for automated API integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input 
                      placeholder="Search clients or agents..." 
                      className="pl-10"
                      data-testid="input-search-relationships"
                    />
                  </div>
                  <Select>
                    <SelectTrigger className="w-48" data-testid="select-relationship-type">
                      <SelectValue placeholder="Relationship Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="backup">Backup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>EUIN Number</TableHead>
                      <TableHead>ARN Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Auto-Populate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationshipsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                          <div className="mt-2">Loading relationships...</div>
                        </TableCell>
                      </TableRow>
                    ) : relationshipsData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                          No relationships found
                        </TableCell>
                      </TableRow>
                    ) : (
                      relationshipsData.map((relationship: any, index: number) => (
                        <TableRow key={relationship.id} data-testid={`relationship-row-${index + 1}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{relationship.clientFirstName} {relationship.clientLastName}</div>
                              <div className="text-sm text-muted-foreground">{relationship.clientEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{relationship.agentFirstName} {relationship.agentLastName}</div>
                              <div className="text-sm text-muted-foreground">{relationship.agentEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {relationship.euinNumber}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              {relationship.arnCode || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={relationship.relationshipType === 'primary' ? 'default' : 'secondary'}>
                              {relationship.relationshipType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Badge className={relationship.autoPopulateEuin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                EUIN: {relationship.autoPopulateEuin ? 'On' : 'Off'}
                              </Badge>
                              <Badge className={relationship.autoPopulateArn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                ARN: {relationship.autoPopulateArn ? 'On' : 'Off'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={relationship.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {relationship.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" data-testid={`button-edit-relationship-${index + 1}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" data-testid={`button-delete-relationship-${index + 1}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Supplier Dashboard Tab */}
          <TabsContent value="supplier-dashboard" className="space-y-6" data-testid="supplier-dashboard-content">
            <SupplierDashboard />
          </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
