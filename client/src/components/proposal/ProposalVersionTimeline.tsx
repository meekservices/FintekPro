import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  History, 
  Clock, 
  CheckCircle2, 
  Eye, 
  Lock, 
  GitBranch,
  ArrowRight,
  ChevronRight,
  FileText,
  User,
  AlertCircle
} from "lucide-react";

interface ProposalVersion {
  id: string;
  proposalVersion: number;
  parentProposalId: string | null;
  isLatestVersion: boolean;
  lockedAt: string | null;
  createdAt: string;
  status: string;
  proposalTitle: string;
  totalInvestmentAmount: string;
  projectedReturns: string;
  agentName: string | null;
}

interface ProposalVersionTimelineProps {
  currentProposalId: string;
  proposalVersion: number;
  parentProposalId: string | null;
  isLatestVersion: boolean;
  lockedAt: string | null;
  onViewVersion?: (version: ProposalVersion) => void;
}

export function ProposalVersionTimeline({
  currentProposalId,
  proposalVersion,
  parentProposalId,
  isLatestVersion,
  lockedAt,
  onViewVersion
}: ProposalVersionTimelineProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ProposalVersion | null>(null);

  const { data: versions, isLoading } = useQuery<ProposalVersion[]>({
    queryKey: [`/api/agent-wizard/proposal-versions/${currentProposalId}`],
    enabled: showTimeline
  });

  const handleViewVersion = (version: ProposalVersion) => {
    setSelectedVersion(version);
    if (onViewVersion) {
      onViewVersion(version);
    }
  };

  return (
    <>
      <Card className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-100 dark:border-indigo-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base">Version History</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white dark:bg-gray-800">
                v{proposalVersion}
              </Badge>
              {isLatestVersion && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Latest
                </Badge>
              )}
              {lockedAt && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {lockedAt 
                ? `Locked on ${new Date(lockedAt).toLocaleDateString()}`
                : parentProposalId 
                  ? 'Created from previous version'
                  : 'Original proposal'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTimeline(true)}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <History className="h-4 w-4 mr-1" />
              View Timeline
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Proposal Version Timeline
            </DialogTitle>
            <DialogDescription>
              Track changes and view historical versions of this proposal
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : versions && versions.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-300" />
                
                <div className="space-y-4">
                  {versions.map((version, index) => (
                    <div key={version.id} className="relative pl-10">
                      <div className={`absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 ${
                        version.id === currentProposalId
                          ? 'bg-indigo-600 border-indigo-600'
                          : version.isLatestVersion
                            ? 'bg-green-500 border-green-500'
                            : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
                      }`} />
                      
                      <Card className={`transition-all ${
                        version.id === currentProposalId
                          ? 'ring-2 ring-indigo-500 ring-offset-2'
                          : 'hover:shadow-md'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Version {version.proposalVersion}</span>
                                {version.id === currentProposalId && (
                                  <Badge variant="outline" className="text-xs">Current</Badge>
                                )}
                                {version.isLatestVersion && (
                                  <Badge className="bg-green-100 text-green-700 text-xs">Latest</Badge>
                                )}
                                {version.lockedAt && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                                    Locked
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {new Date(version.createdAt).toLocaleString()}
                                </span>
                                {version.agentName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    {version.agentName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm mt-2">
                                <span className="text-muted-foreground">
                                  Investment: ₹{parseFloat(version.totalInvestmentAmount || '0').toLocaleString('en-IN')}
                                </span>
                                <span className="text-green-600">
                                  Returns: {version.projectedReturns}%
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewVersion(version)}
                              disabled={version.id === currentProposalId}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                          
                          {version.parentProposalId && index < versions.length - 1 && (
                            <div className="mt-3 pt-3 border-t border-dashed">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ArrowRight className="h-3 w-3" />
                                <span>Created from v{versions[index + 1]?.proposalVersion || '?'}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>No version history available</p>
                <p className="text-sm">This is the original proposal</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {selectedVersion && selectedVersion.id !== currentProposalId && (
        <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Viewing Version {selectedVersion.proposalVersion}
                <Badge variant="secondary" className="ml-2">Read-Only</Badge>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                This is a historical version. To make changes, create a new version from the latest.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Investment Amount</p>
                    <p className="text-2xl font-bold">
                      ₹{parseFloat(selectedVersion.totalInvestmentAmount || '0').toLocaleString('en-IN')}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Projected Returns</p>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedVersion.projectedReturns}%
                    </p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Created: {new Date(selectedVersion.createdAt).toLocaleString()}
                  {selectedVersion.lockedAt && (
                    <span className="ml-4">
                      Locked: {new Date(selectedVersion.lockedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
