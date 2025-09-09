import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, AlertCircle, CheckCircle2, User } from "lucide-react";

interface ProfileData {
  isProfileCompleted?: boolean;
  profileCompleteness?: number;
}

interface ReminderState {
  dismissed: boolean;
  dismissedAt: number;
  showCount: number;
}

const REMINDER_COOLDOWN = 2 * 60 * 60 * 1000; // 2 hours
const MAX_DAILY_REMINDERS = 3;

export function ProfileCompletionReminder() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [reminderVisible, setReminderVisible] = useState(false);

  // Fetch user profile completion status
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", user?.id],
    enabled: !!user?.id,
  });

  // Get reminder state from localStorage
  const getReminderState = (): ReminderState => {
    const stored = localStorage.getItem(`profile_reminder_${user?.id}`);
    if (!stored) return { dismissed: false, dismissedAt: 0, showCount: 0 };
    
    const state = JSON.parse(stored);
    const today = new Date().toDateString();
    const storedDate = new Date(state.dismissedAt).toDateString();
    
    // Reset count daily
    if (today !== storedDate) {
      return { dismissed: false, dismissedAt: 0, showCount: 0 };
    }
    
    return state;
  };

  const updateReminderState = (state: Partial<ReminderState>) => {
    const current = getReminderState();
    const updated = { ...current, ...state };
    localStorage.setItem(`profile_reminder_${user?.id}`, JSON.stringify(updated));
  };

  // Don't show reminders for agents/admins or if loading
  if (!user || isLoading || user.role === "agent" || user.role === "admin") {
    return null;
  }

  const isProfileComplete = profile?.isProfileCompleted === true;
  const profileCompleteness = profile?.profileCompleteness || 0;

  // Don't show if profile is complete
  if (isProfileComplete) {
    return null;
  }

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

    // Strategic moments to show reminders:
    const strategicRoutes = [
      '/', '/dashboard',           // Main entry points
      '/portfolio', '/markets',    // Investment features
      '/loans', '/mutual-funds'    // Financial products
    ];
    
    return strategicRoutes.includes(location);
  };

  // Effect to handle showing reminder
  useEffect(() => {
    if (shouldShowReminder() && !reminderVisible) {
      const timer = setTimeout(() => {
        setReminderVisible(true);
        const state = getReminderState();
        updateReminderState({ 
          dismissed: false,
          showCount: state.showCount + 1 
        });
      }, 2000); // Show after 2 seconds on strategic pages
      
      return () => clearTimeout(timer);
    }
  }, [location, profile, reminderVisible]);

  const handleDismiss = () => {
    setReminderVisible(false);
    updateReminderState({
      dismissed: true,
      dismissedAt: Date.now()
    });
  };

  const handleCompleteProfile = () => {
    setLocation("/profile");
    setReminderVisible(false);
  };

  if (!reminderVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4" data-testid="profile-completion-reminder">
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-amber-500 mt-0.5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Complete Your Profile
                  </h3>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
                    {profileCompleteness}% done
                  </span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  data-testid="button-dismiss-reminder"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Progress value={profileCompleteness} className="h-1.5" />
                  <p className="text-xs text-gray-600">
                    Secure your account and unlock all features with just a few more steps
                  </p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>Quick setup</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>One-time only</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDismiss}
                      className="text-xs h-7 px-3 text-gray-600 hover:text-gray-800"
                      data-testid="button-maybe-later"
                    >
                      Maybe Later
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCompleteProfile}
                      className="text-xs h-7 px-3 bg-blue-600 hover:bg-blue-700"
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