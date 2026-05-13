import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Clock, 
  Calendar, 
  RefreshCw, 
  Building, 
  LucideShield as LucideShield, 
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface ConsentRecord {
  id: string;
  dataSource: string;
  provider?: string;
  status: 'active' | 'revoked' | 'expired';
  consentPurpose: string;
  consentText?: string;
  grantedAt: string;
  expiresAt: string;
  lastSyncedAt?: string;
  syncFrequency?: string;
}

interface ConsentSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consent: ConsentRecord | null;
  sourceLabel: string;
  sourceDescription: string;
  onRevoke: () => void;
  onUpdateFrequency?: (frequency: string) => void;
  onRefreshNow?: () => void;
  isRefreshing?: boolean;
}

export function ConsentSettingsDrawer({
  open,
  onOpenChange,
  consent,
  sourceLabel,
  sourceDescription,
  onRevoke,
  onUpdateFrequency,
  onRefreshNow,
  isRefreshing = false
}: ConsentSettingsDrawerProps) {
  if (!consent) return null;

  const daysUntilExpiry = Math.ceil(
    (new Date(consent.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const isExpiringSoon = daysUntilExpiry <= 7;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]" data-testid="drawer-consent-settings">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LucideShield className="h-5 w-5 text-blue-600" />
            {sourceLabel} Settings
          </SheetTitle>
          <SheetDescription>{sourceDescription}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Consent Status</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Status</span>
                </div>
                <Badge 
                  variant={consent.status === 'active' ? 'default' : 'destructive'}
                  className={consent.status === 'active' ? 'bg-green-600' : ''}
                >
                  {consent.status.charAt(0).toUpperCase() + consent.status.slice(1)}
                </Badge>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Provider</span>
                </div>
                <span className="text-sm font-medium">{consent.provider || 'Default'}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Timeline</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Granted On</span>
                </div>
                <span className="font-medium">{new Date(consent.grantedAt).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {isExpiringSoon ? (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>Expires On</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isExpiringSoon ? 'text-orange-600' : ''}`}>
                    {new Date(consent.expiresAt).toLocaleDateString()}
                  </span>
                  {isExpiringSoon && (
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {daysUntilExpiry} days left
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span>Last Synced</span>
                </div>
                <span className="font-medium">
                  {consent.lastSyncedAt 
                    ? new Date(consent.lastSyncedAt).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Sync Settings</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="sync-frequency">Sync Frequency</Label>
                <Select
                  value={consent.syncFrequency || 'weekly'}
                  onValueChange={(value) => onUpdateFrequency?.(value)}
                >
                  <SelectTrigger id="sync-frequency" data-testid="select-sync-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onRefreshNow}
                disabled={isRefreshing}
                data-testid="button-refresh-now"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-destructive">Danger Zone</h4>
            <p className="text-sm text-muted-foreground">
              Revoking consent will stop all data fetching from this source. Previously fetched data will be retained as per regulations.
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={onRevoke}
              data-testid="button-revoke-from-settings"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Revoke Consent
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
