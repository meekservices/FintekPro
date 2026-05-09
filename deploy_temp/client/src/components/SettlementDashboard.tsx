import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { format, addBusinessDays, differenceInBusinessDays, isAfter, isBefore, isToday } from 'date-fns';
import { Clock, CheckCircle2, AlertCircle, TrendingUp, Banknote, ArrowRightLeft, Calendar, Timer } from 'lucide-react';

interface Deal {
  id: string;
  companyId: string;
  quantity: number;
  agreedPrice: string;
  totalValue: string;
  status: string;
  escrowId?: string;
  escrowedAt?: string;
  paymentCompletedAt?: string;
  sharesTransferredAt?: string;
  settlementDate?: string;
  matchedAt?: string;
  completedAt?: string;
  buyerUserId: string;
  sellerUserId: string;
  platformFee?: string;
  sellerPayout?: string;
  buyerCharge?: string;
}

interface SettlementDashboardProps {
  userRole: 'buyer' | 'seller' | 'admin';
  userId?: string;
}

const SETTLEMENT_CYCLE = {
  T_PLUS_2: 2,
  T_PLUS_3: 3
};

function calculateSettlementDate(escrowedAt: string | undefined, cycle: number = SETTLEMENT_CYCLE.T_PLUS_2): Date {
  const baseDate = escrowedAt ? new Date(escrowedAt) : new Date();
  return addBusinessDays(baseDate, cycle);
}

function getSettlementProgress(deal: Deal): { percentage: number; daysRemaining: number; status: 'on-track' | 'delayed' | 'completed' | 'pending' } {
  if (deal.status === 'completed') {
    return { percentage: 100, daysRemaining: 0, status: 'completed' };
  }
  
  if (!deal.escrowedAt) {
    return { percentage: 0, daysRemaining: -1, status: 'pending' };
  }
  
  const escrowDate = new Date(deal.escrowedAt);
  const expectedDate = calculateSettlementDate(deal.escrowedAt);
  const now = new Date();
  
  const totalDays = differenceInBusinessDays(expectedDate, escrowDate);
  const elapsedDays = differenceInBusinessDays(now, escrowDate);
  
  const percentage = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const daysRemaining = differenceInBusinessDays(expectedDate, now);
  
  const status = isAfter(now, expectedDate) ? 'delayed' : 'on-track';
  
  return { percentage, daysRemaining, status };
}

function SettlementTimeline({ deal }: { deal: Deal }) {
  const stages = [
    { 
      label: 'Payment Received', 
      date: deal.escrowedAt, 
      icon: Banknote,
      completed: !!deal.escrowedAt
    },
    { 
      label: 'Shares Transferred', 
      date: deal.sharesTransferredAt, 
      icon: ArrowRightLeft,
      completed: !!deal.sharesTransferredAt
    },
    { 
      label: 'Settlement Complete', 
      date: deal.completedAt || deal.settlementDate, 
      icon: CheckCircle2,
      completed: deal.status === 'completed'
    }
  ];

  return (
    <div className="flex items-center justify-between w-full py-2">
      {stages.map((stage, index) => (
        <div key={stage.label} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              stage.completed 
                ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <stage.icon className="w-5 h-5" />
            </div>
            <span className="text-xs mt-1 text-center max-w-[80px]">{stage.label}</span>
            {stage.date && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(stage.date), 'MMM dd')}
              </span>
            )}
          </div>
          {index < stages.length - 1 && (
            <div className={`flex-1 h-1 mx-2 ${
              stage.completed ? 'bg-green-500' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

function DealSettlementCard({ deal, userRole }: { deal: Deal; userRole: string }) {
  const progress = getSettlementProgress(deal);
  const expectedSettlement = deal.escrowedAt 
    ? calculateSettlementDate(deal.escrowedAt) 
    : null;

  const statusColors: Record<string, string> = {
    escrowed: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    transfer_pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    pending: 'bg-muted text-muted-foreground'
  };

  return (
    <Card className="mb-4" data-testid={`settlement-card-${deal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Deal #{deal.id.slice(-8)}</CardTitle>
            <CardDescription>
              {deal.quantity} shares @ ₹{parseFloat(deal.agreedPrice).toLocaleString()}
            </CardDescription>
          </div>
          <Badge className={statusColors[deal.status] || statusColors.pending}>
            {deal.status.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Value</span>
              <p className="font-semibold">₹{parseFloat(deal.totalValue).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">
                {userRole === 'seller' ? 'Your Payout' : 'Your Payment'}
              </span>
              <p className="font-semibold text-green-600">
                ₹{parseFloat(userRole === 'seller' ? (deal.sellerPayout || deal.totalValue) : (deal.buyerCharge || deal.totalValue)).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Platform Fee</span>
              <p className="font-medium">₹{parseFloat(deal.platformFee || '0').toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Expected Settlement</span>
              <p className="font-medium">
                {expectedSettlement ? format(expectedSettlement, 'MMM dd, yyyy') : 'Pending'}
              </p>
            </div>
          </div>

          {deal.escrowedAt && deal.status !== 'completed' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Timer className="w-4 h-4" />
                  Settlement Progress (T+2)
                </span>
                <span className={`font-medium ${
                  progress.status === 'delayed' ? 'text-red-600' : 
                  progress.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {progress.daysRemaining > 0 
                    ? `${progress.daysRemaining} business days remaining`
                    : progress.status === 'delayed' 
                      ? `${Math.abs(progress.daysRemaining)} days overdue`
                      : 'Complete'
                  }
                </span>
              </div>
              <Progress 
                value={progress.percentage} 
                className={`h-2 ${progress.status === 'delayed' ? 'bg-red-200 dark:bg-red-800/30' : ''}`}
              />
            </div>
          )}

          <SettlementTimeline deal={deal} />
        </div>
      </CardContent>
    </Card>
  );
}

export function SettlementDashboard({ userRole, userId }: SettlementDashboardProps) {
  const [activeTab, setActiveTab] = useState('active');

  const { data: deals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ['/api/unlisted/my-deals'],
    enabled: !!userId
  });

  const activeDeals = deals.filter(d => 
    ['escrowed', 'transfer_pending', 'payment_pending'].includes(d.status)
  );
  const completedDeals = deals.filter(d => d.status === 'completed');
  const delayedDeals = activeDeals.filter(d => {
    const progress = getSettlementProgress(d);
    return progress.status === 'delayed';
  });

  const stats = {
    totalActive: activeDeals.length,
    totalCompleted: completedDeals.length,
    totalDelayed: delayedDeals.length,
    totalValue: activeDeals.reduce((sum, d) => sum + parseFloat(d.totalValue), 0)
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-8 bg-muted rounded mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settlement-dashboard">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Settlement Dashboard</h2>
          <p className="text-muted-foreground">Track your unlisted share settlements with T+2 cycle</p>
        </div>
        <Button variant="outline" size="sm">
          <Calendar className="w-4 h-4 mr-2" />
          View Calendar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-active-settlements">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Settlements</p>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-completed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.totalCompleted}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-delayed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Delayed</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalDelayed}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-total-value">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Settlement</p>
                <p className="text-2xl font-bold">₹{stats.totalValue.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">
            Active ({activeDeals.length})
          </TabsTrigger>
          <TabsTrigger value="delayed" data-testid="tab-delayed">
            Delayed ({delayedDeals.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed ({completedDeals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeDeals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active settlements</p>
              </CardContent>
            </Card>
          ) : (
            activeDeals.map(deal => (
              <DealSettlementCard key={deal.id} deal={deal} userRole={userRole} />
            ))
          )}
        </TabsContent>

        <TabsContent value="delayed" className="mt-4">
          {delayedDeals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No delayed settlements - all on track!</p>
              </CardContent>
            </Card>
          ) : (
            delayedDeals.map(deal => (
              <DealSettlementCard key={deal.id} deal={deal} userRole={userRole} />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedDeals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed settlements yet</p>
              </CardContent>
            </Card>
          ) : (
            completedDeals.map(deal => (
              <DealSettlementCard key={deal.id} deal={deal} userRole={userRole} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SettlementDashboard;
