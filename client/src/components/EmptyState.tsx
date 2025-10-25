import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`} data-testid="empty-state">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" data-testid="empty-state-icon" />
      <h3 className="text-lg font-semibold mb-2" data-testid="empty-state-title">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md" data-testid="empty-state-description">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} data-testid="empty-state-action">
          {action.label}
        </Button>
      )}
    </div>
  );
}
