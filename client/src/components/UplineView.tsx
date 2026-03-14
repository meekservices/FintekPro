import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, User, ChevronRight } from "lucide-react";

interface UplineAgent {
  id: string;
  fullName: string;
  email: string;
  hierarchyLevel: number | null;
  employeeId: string | null;
  arnCode: string | null;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Master Agent",
  2: "Partner",
  3: "Agent",
  4: "Field Executive",
  5: "Business Associate",
};

export function UplineView() {
  const { data, isLoading } = useQuery<{ upline: UplineAgent[]; levels: number }>({
    queryKey: ["/api/agent/upline"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUp className="h-4 w-4" /> My Upline Chain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const upline = data?.upline || [];

  if (upline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUp className="h-4 w-4" /> My Upline Chain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">You are at the top of your reporting chain.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUp className="h-4 w-4 text-primary" /> My Upline Chain
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {upline.map((agent, index) => {
            const levelLabel = agent.hierarchyLevel ? LEVEL_LABELS[agent.hierarchyLevel] : `Level ${index + 1}`;
            return (
              <div key={agent.id} className="flex items-center gap-3">
                {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground ml-2 shrink-0" />}
                <div className={`flex items-center gap-3 flex-1 rounded-lg border px-3 py-2 ${index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{agent.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {levelLabel}
                    </Badge>
                    {agent.arnCode && (
                      <span className="text-xs text-muted-foreground">ARN: {agent.arnCode}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Commissions from your sales flow through {upline.length} level{upline.length > 1 ? 's' : ''} above you.
        </p>
      </CardContent>
    </Card>
  );
}
