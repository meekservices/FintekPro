import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Zap, Crown } from 'lucide-react';
import { useLocation } from 'wouter';
import type { PlanTier } from '@/hooks/use-subscription';

interface UpgradePromptProps {
  requiredTier: 'pro' | 'elite';
  featureName: string;
  description?: string;
  compact?: boolean;
}

const TIER_META: Record<'pro' | 'elite', {
  icon: typeof Zap;
  color: string;
  badge: string;
  price: string;
}> = {
  pro: {
    icon: Zap,
    color: 'text-blue-600',
    badge: 'Pro',
    price: '₹999/mo',
  },
  elite: {
    icon: Crown,
    color: 'text-yellow-600',
    badge: 'Elite',
    price: '₹25,000/yr',
  },
};

export function UpgradePrompt({ requiredTier, featureName, description, compact = false }: UpgradePromptProps) {
  const [, setLocation] = useLocation();
  const meta = TIER_META[requiredTier];
  const Icon = meta.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">
          <span className="font-medium">{featureName}</span> requires{' '}
          <Badge variant="outline" className={`text-xs ${meta.color}`}>
            {meta.badge}
          </Badge>
        </span>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-7 text-xs"
          onClick={() => setLocation('/pricing')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/20 to-muted/40 p-10 text-center gap-4">
      <div className={`rounded-full bg-background p-4 shadow-sm`}>
        <Icon className={`h-8 w-8 ${meta.color}`} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-1">{featureName}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {description || `This feature is available on the ${meta.badge} plan and above.`}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Badge className={`${requiredTier === 'elite' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-100 text-blue-800 border-blue-200'} text-sm px-3 py-1`}>
          {meta.badge} — Starting at {meta.price}
        </Badge>
        <Button
          onClick={() => setLocation('/pricing')}
          className="mt-1"
        >
          <Icon className="h-4 w-4 mr-2" />
          Upgrade to {meta.badge}
        </Button>
      </div>
    </div>
  );
}
