import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Trash2, Plus, RefreshCw, CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react';

interface ZohoConnection {
  id: string;
  connectionName: string;
  isActive: boolean;
  enabledServices?: string[];
  zohoDataCenter: string;
  createdAt: string;
  lastSyncAt?: string;
  tokenExpiresAt?: string;
}

interface RateLimit {
  connectionId: string;
  percentUsed: number;
  availableTokens: number;
  usedTokens: number;
  maxTokens: number;
}

interface RateLimitsResponse {
  rateLimits?: RateLimit[];
}

const ZOHO_SERVICES = [
  { id: 'CRM', name: 'CRM', description: 'Customer Relationship Management' },
  { id: 'Books', name: 'Books', description: 'Accounting & Invoicing' },
  { id: 'Desk', name: 'Desk', description: 'Customer Support Tickets' },
  { id: 'WorkDrive', name: 'WorkDrive', description: 'Document Storage' },
];

const DATA_CENTERS = [
  { value: 'com', label: 'United States (.com)' },
  { value: 'eu', label: 'Europe (.eu)' },
  { value: 'in', label: 'India (.in)' },
  { value: 'com.au', label: 'Australia (.com.au)' },
  { value: 'jp', label: 'Japan (.jp)' },
];

export default function ZohoConnectionsPage() {
  const { toast } = useToast();
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [connectionName, setConnectionName] = useState('');
  const [dataCenter, setDataCenter] = useState('com');
  const [selectedServices, setSelectedServices] = useState<string[]>(['CRM']);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  const { data: connections, isLoading } = useQuery<ZohoConnection[]>({
    queryKey: ['/api/zoho/connections']
  });

  const { data: rateLimits } = useQuery<RateLimitsResponse>({
    queryKey: ['/api/zoho/admin/rate-limits']
  });

  const handleSetupConnection = async () => {
    if (!connectionName || selectedServices.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a connection name and select at least one service',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Get OAuth URL
      const params = new URLSearchParams({
        services: selectedServices.join(','),
        dataCenter
      });

      const response = await fetch(`/api/zoho/auth/url?${params}`);
      const data = await response.json();

      // Redirect to Zoho OAuth
      window.location.href = data.authUrl;
    } catch (error: any) {
      toast({
        title: 'Setup Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRefreshToken = async (connectionId: string) => {
    setIsRefreshing(connectionId);
    try {
      await apiRequest('POST', `/api/zoho/connections/${connectionId}/refresh`);
      
      queryClient.invalidateQueries({ queryKey: ['/api/zoho/connections'] });
      
      toast({
        title: 'Token Refreshed',
        description: 'OAuth token has been refreshed successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Refresh Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsRefreshing(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection? This will revoke access and remove all sync mappings.')) {
      return;
    }

    try {
      await apiRequest('DELETE', `/api/zoho/connections/${connectionId}`);
      
      queryClient.invalidateQueries({ queryKey: ['/api/zoho/connections'] });
      
      toast({
        title: 'Connection Deleted',
        description: 'Zoho connection has been removed'
      });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getRateLimitForConnection = (connectionId: string) => {
    return rateLimits?.rateLimits?.find(r => r.connectionId === connectionId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading connections...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zoho Connections</h1>
          <p className="text-muted-foreground mt-2">
            Manage OAuth connections and service integrations
          </p>
        </div>
        <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-connection">
              <Plus className="w-4 h-4 mr-2" />
              New Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Setup New Zoho Connection</DialogTitle>
              <DialogDescription>
                Connect FintekPro to your Zoho organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="connection-name">Connection Name</Label>
                <Input
                  id="connection-name"
                  placeholder="e.g., FintekPro Production"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  data-testid="input-connection-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-center">Data Center</Label>
                <Select value={dataCenter} onValueChange={setDataCenter}>
                  <SelectTrigger id="data-center" data-testid="select-data-center">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_CENTERS.map((dc) => (
                      <SelectItem key={dc.value} value={dc.value}>
                        {dc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Services to Enable</Label>
                <div className="space-y-2">
                  {ZOHO_SERVICES.map((service) => (
                    <div key={service.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={service.id}
                        checked={selectedServices.includes(service.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedServices([...selectedServices, service.id]);
                          } else {
                            setSelectedServices(selectedServices.filter(s => s !== service.id));
                          }
                        }}
                        data-testid={`checkbox-service-${service.id.toLowerCase()}`}
                      />
                      <div className="grid gap-1">
                        <Label htmlFor={service.id} className="font-medium">
                          {service.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSetupOpen(false)} data-testid="button-cancel-setup">
                Cancel
              </Button>
              <Button onClick={handleSetupConnection} data-testid="button-connect-zoho">
                <LinkIcon className="w-4 h-4 mr-2" />
                Connect to Zoho
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections List */}
      {connections && connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LinkIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Connections</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect FintekPro to Zoho to enable CRM, Books, Desk, and WorkDrive integrations
            </p>
            <Button onClick={() => setIsSetupOpen(true)} data-testid="button-setup-first-connection">
              Setup First Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections?.map((connection) => {
            const rateLimit = getRateLimitForConnection(connection.id);
            return (
              <Card key={connection.id} data-testid={`connection-card-${connection.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{connection.connectionName}</CardTitle>
                        <Badge variant={connection.isActive ? 'default' : 'secondary'}>
                          {connection.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">
                        Data Center: {connection.zohoDataCenter} • Created: {new Date(connection.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRefreshToken(connection.id)}
                        disabled={isRefreshing === connection.id}
                        data-testid={`button-refresh-${connection.id}`}
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing === connection.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteConnection(connection.id)}
                        data-testid={`button-delete-${connection.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Enabled Services */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Enabled Services</h4>
                      <div className="flex flex-wrap gap-2">
                        {connection.enabledServices?.map((service) => (
                          <Badge key={service} variant="outline">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Rate Limit Status */}
                    {rateLimit && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">API Rate Limit</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Usage:</span>
                            <span className="font-medium">{rateLimit.percentUsed.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                rateLimit.percentUsed > 90 ? 'bg-destructive' :
                                rateLimit.percentUsed > 70 ? 'bg-yellow-500' :
                                'bg-primary'
                              }`}
                              style={{ width: `${Math.min(rateLimit.percentUsed, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{Math.floor(rateLimit.availableTokens).toLocaleString()} available</span>
                            <span>{rateLimit.maxTokens.toLocaleString()} total</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Token Expiry Info */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Last Sync:</span>
                        <span className="ml-2 font-medium">
                          {connection.lastSyncAt 
                            ? new Date(connection.lastSyncAt).toLocaleString()
                            : 'Never'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Token Expires:</span>
                        <span className="ml-2 font-medium">
                          {connection.tokenExpiresAt 
                            ? new Date(connection.tokenExpiresAt).toLocaleString()
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
