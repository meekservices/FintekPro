import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ScrollText, 
  Download, 
  Search, 
  FileText, 
  Shield, 
  ShoppingCart,
  Lock,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditLedger() {
  const [activeTab, setActiveTab] = useState("data-access");
  const [searchQuery, setSearchQuery] = useState("");

  // Query for Data Access Trail
  const { data: dataAccessLogs, isLoading: dataAccessLoading, error: dataAccessError } = useQuery<{ logs: any[]; count: number }>({
    queryKey: ['/api/admin/audit/data-access', { limit: 100 }],
  });

  // Query for KYC Verification Logs
  const { data: kycLogs, isLoading: kycLoading, error: kycError } = useQuery<{ attempts: any[]; count: number }>({
    queryKey: ['/api/admin/audit/kyc-verification', { limit: 100 }],
  });

  // Query for MF Order Execution
  const { data: orderLogs, isLoading: ordersLoading, error: ordersError } = useQuery<{ orders: any[]; count: number }>({
    queryKey: ['/api/admin/audit/mf-orders', { limit: 100 }],
  });

  // Query for Consent Ledger
  const { data: consentLogs, isLoading: consentsLoading, error: consentsError } = useQuery<{ consents: any[]; count: number }>({
    queryKey: ['/api/admin/audit/aa-consent-ledger', { limit: 100 }],
  });

  // Query for Third Party API Logs
  const { data: apiLogs, isLoading: apiLogsLoading, error: apiLogsError } = useQuery<{ logs: any[]; count: number }>({
    queryKey: ['/api/admin/audit/third-party-api', { limit: 100 }],
  });

  // Query for Hash Chain Integrity
  const { data: hashChainData, isLoading: hashChainLoading, error: hashChainError } = useQuery<{ 
    isValid: boolean; 
    totalEntries: number; 
    invalidEntries?: any[] 
  }>({
    queryKey: ['/api/admin/audit/hash-chain-verify'],
  });

  const handleExport = async (format: 'csv' | 'pdf' | 'amfi' | 'sebi') => {
    if (format !== 'csv') {
      console.log(`${format} export not yet implemented`);
      return;
    }

    // Map activeTab to export endpoint
    const exportEndpoints: Record<string, string> = {
      'data-access': '/api/admin/audit/export/data-access',
      'kyc-verification': '/api/admin/audit/export/kyc-verification',
      'mf-orders': '/api/admin/audit/export/mf-orders',
      'aa-consent-ledger': '/api/admin/audit/export/aa-consent-ledger',
      'third-party-api': '/api/admin/audit/export/third-party-api',
    };

    const endpoint = exportEndpoints[activeTab];
    if (!endpoint) {
      console.error(`No export endpoint for tab: ${activeTab}`);
      return;
    }

    try {
      // Use authenticated fetch to download CSV with session credentials
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include', // Include session cookies for authentication
        headers: {
          'Accept': 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${activeTab}-audit-logs.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome?.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit & Compliance Ledger</h1>
          <p className="text-gray-400 mt-1">Regulator-safe audit trails with hash chain integrity</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            className="bg-gray-800 border-gray-700 text-gray-300"
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('pdf')}
            className="bg-gray-800 border-gray-700 text-gray-300"
            data-testid="button-export-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search audit logs by user ID, action, or reference..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
          data-testid="input-search-audit"
        />
      </div>

      {/* Audit Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800 border border-gray-700 p-1">
          <TabsTrigger 
            value="data-access" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-data-access"
          >
            <Shield className="h-4 w-4 mr-2" />
            Data Access Trail
          </TabsTrigger>
          <TabsTrigger 
            value="kyc-verification" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-kyc"
          >
            <FileText className="h-4 w-4 mr-2" />
            KYC Verification
          </TabsTrigger>
          <TabsTrigger 
            value="mf-orders" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-orders"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            MF Order Execution
          </TabsTrigger>
          <TabsTrigger 
            value="consent-ledger" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-consent"
          >
            <Lock className="h-4 w-4 mr-2" />
            Consent Ledger
          </TabsTrigger>
          <TabsTrigger 
            value="third-party-api" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-api"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Third Party API
          </TabsTrigger>
          <TabsTrigger 
            value="hash-chain" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-hash-chain"
          >
            <ScrollText className="h-4 w-4 mr-2" />
            Hash Chain Integrity
          </TabsTrigger>
        </TabsList>

        {/* Data Access Trail Tab */}
        <TabsContent value="data-access" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Compliance Audit Trail</CardTitle>
              <CardDescription className="text-gray-400">
                All compliance-related data access and modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dataAccessLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-700 animate-pulse rounded" />
                  ))}
                </div>
              ) : dataAccessLogs?.logs && dataAccessLogs.logs.length > 0 ? (
                <div className="space-y-3">
                  {dataAccessLogs.logs.map((log: any) => (
                    <div 
                      key={log.id}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      data-testid={`data-access-log-${log.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-gray-800 border-gray-600">
                            {log.action}
                          </Badge>
                          <span className="text-sm text-gray-400">User: {log.userId}</span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.fieldChanged && (
                        <p className="text-sm text-gray-300">
                          Field: <span className="font-mono text-white">{log.fieldChanged}</span>
                          {log.oldValue && log.newValue && (
                            <span className="text-gray-400">
                              {' '}({log.oldValue} → {log.newValue})
                            </span>
                          )}
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-sm text-gray-400 mt-2">Reason: {log.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No data access logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* KYC Verification Tab */}
        <TabsContent value="kyc-verification" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">KYC Verification Attempts</CardTitle>
              <CardDescription className="text-gray-400">
                All KYC verification attempts with method and outcome
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kycLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-700 animate-pulse rounded" />
                  ))}
                </div>
              ) : kycLogs?.attempts && kycLogs.attempts.length > 0 ? (
                <div className="space-y-3">
                  {kycLogs.attempts.map((attempt: any) => (
                    <div 
                      key={attempt.id}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      data-testid={`kyc-attempt-${attempt.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getOutcomeIcon(attempt.outcome)}
                          <Badge variant="outline" className="bg-gray-800 border-gray-600">
                            {attempt.verificationMethod}
                          </Badge>
                          {attempt.provider && (
                            <span className="text-sm text-gray-400">{attempt.provider}</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(attempt.attemptedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">User: {attempt.userId}</span>
                        <Badge 
                          variant={attempt.outcome === 'success' ? 'default' : 'destructive'}
                          className={attempt.outcome === 'success' ? 'bg-green-600' : 'bg-red-600'}
                        >
                          {attempt.outcome}
                        </Badge>
                        {attempt.latencyMs && (
                          <span className="text-gray-400">{attempt.latencyMs}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No KYC verification logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MF Orders Tab */}
        <TabsContent value="mf-orders" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Mutual Fund Order Execution</CardTitle>
              <CardDescription className="text-gray-400">
                Order execution audit trail for compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-700 animate-pulse rounded" />
                  ))}
                </div>
              ) : orderLogs?.orders && orderLogs.orders.length > 0 ? (
                <div className="space-y-3">
                  {orderLogs.orders.map((order: any) => (
                    <div 
                      key={order.id}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      data-testid={`order-${order.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-gray-800 border-gray-600">
                            {order.symbol}
                          </Badge>
                          <span className="text-sm text-gray-400">{order.action}</span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">Order ID: {order.orderId}</span>
                        <Badge 
                          variant={order.status === 'Filled' ? 'default' : 'secondary'}
                          className={order.status === 'Filled' ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {order.status}
                        </Badge>
                        <span className="text-white">{order.totalQuantity} units</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No order execution logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent Ledger Tab */}
        <TabsContent value="consent-ledger" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Account Aggregator Consent Ledger</CardTitle>
              <CardDescription className="text-gray-400">
                RBI AA Framework consent management audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-700 animate-pulse rounded" />
                  ))}
                </div>
              ) : consentLogs?.consents && consentLogs.consents.length > 0 ? (
                <div className="space-y-3">
                  {consentLogs.consents.map((consent: any) => (
                    <div 
                      key={consent.id}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      data-testid={`consent-${consent.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-gray-800 border-gray-600">
                            {consent.purpose}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            Consent ID: {consent.consentId}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(consent.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge 
                          variant={consent.consentStatus === 'active' ? 'default' : 'secondary'}
                          className={consent.consentStatus === 'active' ? 'bg-green-600' : 'bg-gray-600'}
                        >
                          {consent.consentStatus}
                        </Badge>
                        {consent.aaName && (
                          <span className="text-gray-400">AA: {consent.aaName}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No consent logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Third Party API Tab */}
        <TabsContent value="third-party-api" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Third Party API Access Logs</CardTitle>
              <CardDescription className="text-gray-400">
                External API calls and data fetch operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiLogsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-700 animate-pulse rounded" />
                  ))}
                </div>
              ) : apiLogs?.logs && apiLogs.logs.length > 0 ? (
                <div className="space-y-3">
                  {apiLogs.logs.map((log: any) => (
                    <div 
                      key={log.id}
                      className="p-4 bg-gray-900 rounded-lg border border-gray-700"
                      data-testid={`api-log-${log.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          {getOutcomeIcon(log.fetchStatus)}
                          <Badge variant="outline" className="bg-gray-800 border-gray-600">
                            {log.fetchType}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            Session: {log.sessionId}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge variant={log.fetchStatus === 'completed' ? 'default' : 'secondary'}>
                          {log.fetchStatus}
                        </Badge>
                        {log.accountsFetched && (
                          <span className="text-gray-400">
                            {log.accountsFetched}/{log.accountsRequested} accounts
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ExternalLink className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No API access logs found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hash Chain Integrity Tab */}
        <TabsContent value="hash-chain" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Hash Chain Integrity Verification
                {hashChainData?.isValid && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Tamper-evident blockchain-like audit trail verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hashChainLoading ? (
                <div className="h-32 bg-gray-700 animate-pulse rounded" />
              ) : hashChainData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-400 mb-1">Total Entries</p>
                      <p className="text-2xl font-bold text-white">
                        {hashChainData.totalEntries || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-400 mb-1">Chain Integrity</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        hashChainData.isValid ? "text-green-500" : "text-red-500"
                      )}>
                        {hashChainData.isValid ? 'VALID' : 'INVALID'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-400 mb-1">Last Verified</p>
                      <p className="text-sm font-medium text-white">
                        {new Date().toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {hashChainData.invalidEntries && hashChainData.invalidEntries.length > 0 && (
                    <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                      <h3 className="text-sm font-medium text-red-300 mb-2">
                        ⚠️ Integrity Violations Detected
                      </h3>
                      <div className="space-y-2">
                        {hashChainData.invalidEntries.map((entry: any, i: number) => (
                          <p key={i} className="text-sm text-gray-300 font-mono">
                            Entry #{entry.sequenceNumber}: Hash mismatch
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <ScrollText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No hash chain data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
