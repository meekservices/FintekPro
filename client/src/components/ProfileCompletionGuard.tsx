import { ReactNode, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProfileCompletionReminder } from "./ProfileCompletionReminder";
import { Loader2 } from "lucide-react";

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user, isLoading } = useAuth();

  // Don't show reminder while loading or if not authenticated
  if (isLoading || !user) {
    return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
  }

  // Don't guard for agent and admin roles - no reminders needed
  if (user?.roles?.includes("agent") || user?.roles?.includes("admin")) {
    return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
  }

  // Always render content, but include smart reminders for incomplete profiles
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfileCompletionReminder />
      {children}
    </Suspense>
  );
}