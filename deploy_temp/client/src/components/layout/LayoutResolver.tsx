import { useUserPreferences, NavPosition } from "@/hooks/use-user-preferences";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { AppLayout } from "./app-layout";
import { TopNavLayout } from "./TopNavLayout";
import { BottomNavLayout } from "./BottomNavLayout";

interface LayoutResolverProps {
  children: React.ReactNode;
  forceLayout?: NavPosition;
}

export function LayoutResolver({ children, forceLayout }: LayoutResolverProps) {
  const { navPosition, isLoading } = useUserPreferences();
  const isMobile = useIsMobile();
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

  const userRoles = (user as any)?.roles || [];
  const isAdmin = userRoles.includes("admin") || userRoles.includes("superadmin");

  const isAdminPath = location.startsWith("/admin");
  if (isAdminPath) {
    return <>{children}</>;
  }

  if (isAdmin && !forceLayout) {
    return <AppLayout>{children}</AppLayout>;
  }

  const effectivePosition = forceLayout || navPosition;

  if (!isAuthenticated) {
    return <AppLayout>{children}</AppLayout>;
  }

  if (isMobile && effectivePosition === "left") {
    return <BottomNavLayout>{children}</BottomNavLayout>;
  }

  switch (effectivePosition) {
    case "top":
      return <TopNavLayout>{children}</TopNavLayout>;
    case "bottom":
      return <BottomNavLayout>{children}</BottomNavLayout>;
    default:
      return <AppLayout>{children}</AppLayout>;
  }
}
