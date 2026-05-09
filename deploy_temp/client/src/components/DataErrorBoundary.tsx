import { Component, ReactNode, ErrorInfo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { trackException } from '@/lib/error-tracking';

interface Props {
  children: ReactNode;
  sectionName?: string;
  onRetry?: () => void;
  fallbackHeight?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DataErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`[${this.props.sectionName || 'DataSection'}] Error:`, error);
    }
    
    trackException(error, {
      module: this.props.sectionName || 'data-section',
      metadata: { componentStack: errorInfo.componentStack }
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card 
          className={`border-dashed border-destructive/50 ${this.props.fallbackHeight || 'min-h-[200px]'}`}
          data-testid={`error-boundary-${this.props.sectionName || 'section'}`}
        >
          <CardContent className="flex flex-col items-center justify-center h-full py-8">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <h4 className="font-medium text-sm mb-1">
              Failed to load {this.props.sectionName || 'this section'}
            </h4>
            <p className="text-xs text-muted-foreground mb-4 text-center max-w-xs">
              We couldn't fetch the data. This might be a temporary issue.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={this.handleRetry}
              data-testid="button-retry-section"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function withDataErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionName: string
) {
  return function WithErrorBoundary(props: P) {
    return (
      <DataErrorBoundary sectionName={sectionName}>
        <WrappedComponent {...props} />
      </DataErrorBoundary>
    );
  };
}
