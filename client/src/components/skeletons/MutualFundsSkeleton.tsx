import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MutualFundsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-8 mx-auto" />
                  <Skeleton className="h-5 w-12 mx-auto" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-8 mx-auto" />
                  <Skeleton className="h-5 w-12 mx-auto" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-8 mx-auto" />
                  <Skeleton className="h-5 w-12 mx-auto" />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SIPCalculatorSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 bg-muted rounded-lg p-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
