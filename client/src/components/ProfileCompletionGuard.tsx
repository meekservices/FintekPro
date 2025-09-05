import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

interface ProfileData {
  isProfileCompleted?: boolean;
  profileCompleteness?: number;
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch user profile completion status
  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", user?.id],
    enabled: !!user?.id,
  });

  // Don't guard for agent and admin roles
  if (user?.role === "agent" || user?.role === "admin") {
    return <>{children}</>;
  }

  // Show loading state while checking profile
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-profile-check">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking your profile status...</p>
        </div>
      </div>
    );
  }

  // Check if profile is complete
  const isProfileComplete = profile?.isProfileCompleted === true;
  const profileCompleteness = profile?.profileCompleteness || 0;

  // If profile is not complete, show the mandatory completion page
  if (!isProfileComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" data-testid="profile-completion-required">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-16 w-16 text-amber-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Complete Your Profile
            </CardTitle>
            <CardDescription className="text-lg">
              To comply with financial regulations and ensure the security of your account, 
              please complete your KYC (Know Your Customer) profile.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Profile Completion</span>
                <span className="text-sm text-gray-600">{profileCompleteness}%</span>
              </div>
              <Progress value={profileCompleteness} className="h-2" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Why is this required?</h4>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Regulatory compliance with financial authorities</li>
                <li>• Enhanced security for your investments</li>
                <li>• Access to all platform features</li>
                <li>• Protection against fraud and money laundering</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-2">What happens after completion?</h4>
              <div className="flex items-center space-x-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>One-time setup - you won't need to do this again</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-800 mt-1">
                <CheckCircle2 className="h-4 w-4" />
                <span>Full access to all FintekPro features</span>
              </div>
            </div>

            <button
              onClick={() => setLocation("/complete-profile")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              data-testid="button-complete-profile"
            >
              Complete My Profile Now
            </button>
            
            <p className="text-xs text-gray-500 text-center">
              This is a mandatory requirement. You can access other features after completion.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile is complete, render the protected content
  return <>{children}</>;
}