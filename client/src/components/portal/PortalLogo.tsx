import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSubdomain } from "@/hooks/useSubdomain";
import mainLogoImg from "@assets/fintekpro_main_1772539048013.png";
import agentLogoImg from "@assets/fintekpro_agent_1772539048012.png";
import partnerLogoImg from "@assets/fintekpro_partners_1772539048013.png";
import adminLogoImg from "@assets/fintekpro_admin_1772539048012.png";

interface PortalMeta {
  portal_type: string;
  label: string;
  logo_path: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  sidebar_bg: string;
  sidebar_text: string;
}

const FALLBACK_META: PortalMeta = {
  portal_type: "main",
  label: "FintekPro",
  logo_path: "/api/system/portal-logo/main",
  tagline: "Your Financial Future, Simplified",
  primary_color: "#2563EB",
  accent_color: "#3B82F6",
  sidebar_bg: "#1A2B3D",
  sidebar_text: "#E2E8F0",
};

export function usePortalMeta() {
  return useQuery<PortalMeta>({
    queryKey: ["/api/system/portal-meta"],
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    placeholderData: FALLBACK_META,
  });
}

const LOGO_MAP: Record<string, string> = {
  main: mainLogoImg,
  agent: agentLogoImg,
  partner: partnerLogoImg,
  admin: adminLogoImg,
};

function resolveLogoSrc(apiPortalType: string, frontendSubdomain: string): string {
  // Frontend subdomain detection is reliable across all environments
  // (Replit dev, Replit deployment, and custom domains like agent.fintekpro.com).
  // Prefer it over the API value which can return "main" when the server
  // cannot detect a subdomain (e.g. on *.replit.app domains).
  const frontendType = frontendSubdomain || apiPortalType || "main";
  return LOGO_MAP[frontendType] ?? LOGO_MAP["main"];
}

interface PortalLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  iconOnly?: boolean;
}

export function PortalLogo({ className, size = "md", showTagline = false, iconOnly = false }: PortalLogoProps) {
  const { data: meta } = usePortalMeta();
  const { subdomain } = useSubdomain();
  const config = meta || FALLBACK_META;

  const sizeMap = {
    sm: { icon: "h-7 w-7", text: "text-base", tagline: "text-[10px]" },
    md: { icon: "h-9 w-9", text: "text-lg", tagline: "text-xs" },
    lg: { icon: "h-12 w-12", text: "text-xl", tagline: "text-sm" },
    xl: { icon: "h-16 w-16", text: "text-2xl", tagline: "text-base" },
  };

  const s = sizeMap[size];
  const customLogo = resolveLogoSrc(config.portal_type, subdomain);

  if (iconOnly) {
    return (
      <img
        src={customLogo}
        alt={config.label}
        className={cn("object-contain rounded-lg", s.icon, className)}
      />
    );
  }

  const imgSizeMap = {
    sm: "h-7 w-auto max-w-[120px]",
    md: "h-9 w-auto max-w-[160px]",
    lg: "h-12 w-auto max-w-[220px]",
    xl: "h-20 w-auto max-w-[320px]",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img
        src={customLogo}
        alt={config.label}
        className={cn("object-contain shrink-0", imgSizeMap[size])}
      />
      {showTagline && (
        <div className="flex flex-col min-w-0">
          <span className={cn("text-muted-foreground leading-tight truncate", s.tagline)}>
            {config.tagline}
          </span>
        </div>
      )}
    </div>
  );
}

export function PortalSvgLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const { data: meta } = usePortalMeta();
  const { subdomain } = useSubdomain();
  const config = meta || FALLBACK_META;

  const sizeMap = { sm: { w: 140, h: 32 }, md: { w: 200, h: 46 }, lg: { w: 280, h: 64 } };
  const s = sizeMap[size];

  const customLogo = resolveLogoSrc(config.portal_type, subdomain);

  return (
    <img
      src={customLogo}
      alt={config.label}
      width={s.w}
      height={s.h}
      className={cn("object-contain", className)}
    />
  );
}
