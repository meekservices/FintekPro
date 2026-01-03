import { LucideIcon, Briefcase, PiggyBank, TrendingUp, FileText, Users, CreditCard, Building2, Shield, Bell, Calendar, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action, 
  secondaryAction,
  className = '',
  variant = 'default'
}: EmptyStateProps) {
  const isCompact = variant === 'compact';
  const isCard = variant === 'card';
  
  return (
    <div 
      className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-6 px-3' : 'py-12 px-4'} ${isCard ? 'bg-muted/30 rounded-lg border border-dashed' : ''} ${className}`} 
      data-testid="empty-state"
    >
      <div className={`${isCompact ? 'p-2' : 'p-3'} bg-muted rounded-full mb-${isCompact ? '3' : '4'}`}>
        <Icon className={`${isCompact ? 'h-8 w-8' : 'h-12 w-12'} text-muted-foreground`} data-testid="empty-state-icon" />
      </div>
      <h3 className={`${isCompact ? 'text-base' : 'text-lg'} font-semibold mb-2`} data-testid="empty-state-title">
        {title}
      </h3>
      <p className={`text-sm text-muted-foreground mb-4 max-w-md`} data-testid="empty-state-description">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button onClick={action.onClick} size={isCompact ? 'sm' : 'default'} data-testid="empty-state-action">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick} size={isCompact ? 'sm' : 'default'} data-testid="empty-state-secondary-action">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

type EmptyStatePreset = 
  | 'portfolio' 
  | 'stocks' 
  | 'mutual-funds' 
  | 'bonds' 
  | 'epf' 
  | 'ppf' 
  | 'insurance' 
  | 'leads' 
  | 'clients'
  | 'transactions'
  | 'notifications'
  | 'documents'
  | 'goals'
  | 'calendar';

interface PresetEmptyStateProps {
  preset: EmptyStatePreset;
  onAction?: () => void;
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

const EMPTY_STATE_PRESETS: Record<EmptyStatePreset, {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute?: string;
}> = {
  portfolio: {
    icon: Briefcase,
    title: 'No investments yet',
    description: 'Start building your wealth by adding your first investment. We support stocks, mutual funds, bonds, and more.',
    actionLabel: 'Explore Investments',
    actionRoute: '/investments'
  },
  stocks: {
    icon: TrendingUp,
    title: 'No stock holdings',
    description: 'You haven\'t added any stocks to your portfolio yet. Start investing in the stock market today.',
    actionLabel: 'Browse Stocks',
    actionRoute: '/stocks'
  },
  'mutual-funds': {
    icon: PiggyBank,
    title: 'No mutual fund investments',
    description: 'Diversify your portfolio with mutual funds. Choose from equity, debt, or hybrid funds.',
    actionLabel: 'Explore Mutual Funds',
    actionRoute: '/mutual-funds'
  },
  bonds: {
    icon: Building2,
    title: 'No bond holdings',
    description: 'Add stability to your portfolio with government and corporate bonds.',
    actionLabel: 'Browse Bonds',
    actionRoute: '/bonds'
  },
  epf: {
    icon: Shield,
    title: 'EPF account not linked',
    description: 'Link your Employee Provident Fund account to track your retirement savings automatically.',
    actionLabel: 'Link EPF Account'
  },
  ppf: {
    icon: PiggyBank,
    title: 'PPF account not linked',
    description: 'Connect your Public Provident Fund account to monitor your tax-saving investments.',
    actionLabel: 'Link PPF Account'
  },
  insurance: {
    icon: Shield,
    title: 'No insurance policies',
    description: 'Protect yourself and your family. Add your life, health, and motor insurance policies.',
    actionLabel: 'Add Insurance',
    actionRoute: '/insurance'
  },
  leads: {
    icon: Users,
    title: 'No leads yet',
    description: 'Start adding potential clients to build your sales pipeline.',
    actionLabel: 'Add New Lead'
  },
  clients: {
    icon: Users,
    title: 'No clients yet',
    description: 'Your client list is empty. Convert leads or add new clients to get started.',
    actionLabel: 'Add Client'
  },
  transactions: {
    icon: CreditCard,
    title: 'No transactions',
    description: 'Your transaction history will appear here once you make your first investment.',
    actionLabel: 'Make First Investment',
    actionRoute: '/investments'
  },
  notifications: {
    icon: Bell,
    title: 'All caught up!',
    description: 'You have no new notifications. We\'ll notify you about important updates.',
    actionLabel: 'Notification Settings'
  },
  documents: {
    icon: FileText,
    title: 'No documents',
    description: 'Upload your financial documents for secure storage and easy access.',
    actionLabel: 'Upload Document'
  },
  goals: {
    icon: Target,
    title: 'No financial goals set',
    description: 'Set financial goals to track your progress towards retirement, education, or other milestones.',
    actionLabel: 'Create Goal'
  },
  calendar: {
    icon: Calendar,
    title: 'No upcoming events',
    description: 'Your financial calendar is empty. SIP dates, maturity dates, and payment reminders will appear here.',
    actionLabel: 'View Calendar'
  }
};

export function PresetEmptyState({ preset, onAction, className, variant = 'default' }: PresetEmptyStateProps) {
  const [, setLocation] = useLocation();
  const config = EMPTY_STATE_PRESETS[preset];
  
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (config.actionRoute) {
      setLocation(config.actionRoute);
    }
  };

  return (
    <EmptyState
      icon={config.icon}
      title={config.title}
      description={config.description}
      action={{
        label: config.actionLabel,
        onClick: handleAction
      }}
      className={className}
      variant={variant}
    />
  );
}
