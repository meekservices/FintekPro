import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WifiOff, RefreshCw, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface NetworkErrorScreenProps {
  onRetry?: () => void;
  message?: string;
  showBackButton?: boolean;
}

export function NetworkErrorScreen({ 
  onRetry, 
  message = "Unable to connect to the server. Please check your internet connection and try again.",
  showBackButton = true 
}: NetworkErrorScreenProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-4">
            <WifiOff className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-xl">Connection Error</CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {onRetry && (
            <Button onClick={onRetry} className="w-full" data-testid="button-retry">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          {showBackButton && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setLocation("/")}
              data-testid="button-go-home"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
