import React from "react";
import { CheckCircle2, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  pros?: string[] | null;
  cons?: string[] | null;
  companyName?: string;
}

export const ScreenerProsConsBox: React.FC<Props> = ({ pros, cons, companyName }) => {
  const cleanPros = Array.isArray(pros) ? pros.filter((p) => p && typeof p === "string" && p.trim().length > 3) : [];
  const cleanCons = Array.isArray(cons) ? cons.filter((c) => c && typeof c === "string" && c.trim().length > 3) : [];

  if (cleanPros.length === 0 && cleanCons.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
      {/* ── Pros Box (Screener.in Style) ────────────────────────────────────── */}
      <Card className="border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs">
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>Pros</span>
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              ({cleanPros.length} identified{companyName ? ` • ${companyName}` : ""})
            </span>
          </div>

          {cleanPros.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-foreground/90">
              {cleanPros.map((pro, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              No significant financial strengths flagged under current model parameters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Cons Box (Screener.in Style) ────────────────────────────────────── */}
      <Card className="border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 shadow-xs">
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
            <ThumbsDown className="h-3.5 w-3.5" />
            <span>Cons</span>
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              ({cleanCons.length} flagged)
            </span>
          </div>

          {cleanCons.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-foreground/90">
              {cleanCons.map((con, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              No material financial weaknesses or balance sheet risks detected.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

