import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, AlertCircle, CheckCircle2, User, Shield, TrendingUp, Wallet } from "lucide-react";

interface ReminderState {
  dismissed: boolean;
  dismissedAt: number;
  showCount: number;
  lastRoute: string;
}

const REMINDER_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
const MAX_DAILY_REMINDERS = 3;

export function ProfileCompletionReminder() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [reminderVisible, setReminderVisible] = useState(false);
  const { isComplete, completeness, shouldShowReminders, getReminderMessage, getReminderPriority } = useProfileCompletion();

  // Get reminder state from localStorage
  const getReminderState = (): ReminderState => {
    const stored = localStorage.getItem(`profile_reminder_${user?.id}`);
    if (!stored) return { dismissed: false, dismissedAt: 0, showCount: 0, lastRoute: '' };
    
    const state = JSON.parse(stored);
    const today = new Date().toDateString();
    const storedDate = new Date(state.dismissedAt).toDateString();
    
    // Reset count daily
    if (today !== storedDate) {
      return { dismissed: false, dismissedAt: 0, showCount: 0, lastRoute: state.lastRoute || '' };
    }
    
    return state;
  };

  const updateReminderState = (state: Partial<ReminderState>) => {
    const current = getReminderState();
    const updated = { ...current, ...state };
    localStorage.setItem(`profile_reminder_${user?.id}`, JSON.stringify(updated));
  };

  // Smart trigger logic - show reminders at strategic moments
  const shouldShowReminder = () => {
    const state = getReminderState();
    
    // Don't show if dismissed recently or max daily limit reached
    if (state.dismissed && Date.now() - state.dismissedAt < REMINDER_COOLDOWN) {
      return false;
    }
    
    if (state.showCount >= MAX_DAILY_REMINDERS) {
      return false;
    }

    // Strategic moments to show reminders based on route and completion level:
    const strategicRoutes = [
      '/', '/dashboard',           // Main entry points
      '/portfolio', '/markets',    // Investment features
      '/loans', '/mutual-funds',   // Financial products
      '/calculators', '/wealth'    // Planning tools
    ];

    // Show on different routes to avoid repetition
    const isStrategicRoute = strategicRoutes.includes(location);
    const hasChangedRoute = state.lastRoute !== location;
    
    return isStrategicRoute && hasChangedRoute;
  };

  // Effect to handle showing reminder
  useEffect(() => {
    if (shouldShowReminder() && !reminderVisible) {
      const timer = setTimeout(() => {
        setReminderVisible(true);
        const state = getReminderState();
        updateReminderState({ 
          dismissed: false,
          showCount: state.showCount + 1,
          lastRoute: location
        });
      }, 2000); // Show after 2 seconds on strategic pages
      
      return () => clearTimeout(timer);
    }
  }, [location, reminderVisible, shouldShowReminder]);

  const handleDismiss = () => {
    setReminderVisible(false);
    updateReminderState({
      dismissed: true,
      dismissedAt: Date.now()
    });
  };

  const handleCompleteProfile = () => {
    setLocation("/kyc-dashboard");
    setReminderVisible(false);
  };

  // Route-specific messaging and icons
  const getRouteSpecificContent = () => {
    const priority = getReminderPriority();
    const baseMessage = getReminderMessage();
    
    switch (location) {
      case '/portfolio':
      case '/markets':
        return {
          icon: <TrendingUp className="h-6 w-6 text-blue-500" />,
          message: `${baseMessage} - Complete your profile to enable advanced portfolio tracking and market insights`,
          urgency: 'Secure your investments with complete KYC verification'
        };
      case '/loans':
        return {
          icon: <Wallet className="h-6 w-6 text-green-500" />,
          message: `${baseMessage} - Profile completion is required for loan applications and financial products`,
          urgency: 'Complete KYC to access loan services'
        };
      default:
        return {
          icon: <Shield className="h-6 w-6 text-amber-500" />,
          message: baseMessage,
          urgency: priority === 'high' ? 'Action needed for account security' : 'Complete when convenient'
        };
    }
  };

  // Early return after all hooks if reminders shouldn't be shown
  if (!shouldShowReminders || !reminderVisible) return null;

  const { icon, message, urgency } = getRouteSpecificContent();
  const priority = getReminderPriority();

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4" data-testid="profile-completion-reminder">
      <Card className={`border shadow-lg ${
        priority === 'high' 
          ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200' 
          : priority === 'medium'
          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Complete Your Profile
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    priority === 'high' 
                      ? 'bg-red-100 text-red-800' 
                      : priority === 'medium'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {completeness}% done
                  </span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-muted-foreground transition-colors"
                  data-testid="button-dismiss-reminder"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Progress value={completeness} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {message}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {urgency}
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>Quick setup</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>One-time only</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3 text-blue-500" />
                      <span>Regulatory compliance</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="text-xs h-7 px-3 text-muted-foreground hover:text-foreground"
                      data-testid="button-maybe-later"
                    >
                      Maybe Later
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCompleteProfile}
                      className={`text-xs h-7 px-3 ${
                        priority === 'high' 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : priority === 'medium'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      data-testid="button-complete-now"
                    >
                      Complete Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}