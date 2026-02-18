import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

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

interface PortalLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  iconOnly?: boolean;
}

export function PortalLogo({ className, size = "md", showTagline = false, iconOnly = false }: PortalLogoProps) {
  const { data: meta } = usePortalMeta();
  const config = meta || FALLBACK_META;

  const sizeMap = {
    sm: { icon: "h-7 w-7", text: "text-base", tagline: "text-[10px]" },
    md: { icon: "h-9 w-9", text: "text-lg", tagline: "text-xs" },
    lg: { icon: "h-12 w-12", text: "text-xl", tagline: "text-sm" },
  };

  const s = sizeMap[size];

  if (iconOnly) {
    return (
      <div
        className={cn("rounded-lg flex items-center justify-center font-bold text-white", s.icon, className)}
        style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${config.accent_color})` }}
      >
        <span className={size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"}>FP</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("rounded-lg flex items-center justify-center font-bold text-white shrink-0", s.icon)}
        style={{ background: `linear-gradient(135deg, ${config.primary_color}, ${config.accent_color})` }}
      >
        <span className={size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base"}>FP</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn("font-bold leading-tight truncate", s.text)} style={{ color: config.primary_color }}>
          {config.label}
        </span>
        {showTagline && (
          <span className={cn("text-muted-foreground leading-tight truncate", s.tagline)}>
            {config.tagline}
          </span>
        )}
      </div>
    </div>
  );
}

export function PortalSvgLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const { data: meta } = usePortalMeta();
  const config = meta || FALLBACK_META;

  const sizeMap = { sm: { w: 140, h: 32 }, md: { w: 200, h: 46 }, lg: { w: 280, h: 64 } };
  const s = sizeMap[size];

  return (
    <img
      src={config.logo_path}
      alt={config.label}
      width={s.w}
      height={s.h}
      className={cn("object-contain", className)}
    />
  );
}
