import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProfileCompletionReminder } from "./ProfileCompletionReminder";

interface ProfileCompletionGuardProps {
  children: ReactNode;
}

export default function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const { user, isLoading } = useAuth();

  // Don't show reminder while loading or if not authenticated
  if (isLoading || !user) {
    return <>{children}</>;
  }

  // Don't guard for agent and admin roles - no reminders needed
  if (user?.roles?.includes("agent") || user?.roles?.includes("admin")) {
    return <>{children}</>;
  }

  // Always render content, but include smart reminders for incomplete profiles
  return (
    <>
      <ProfileCompletionReminder />
      {children}
    </>
  );
}