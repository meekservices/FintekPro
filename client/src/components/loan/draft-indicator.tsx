import { Cloud, CloudOff, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DraftIndicatorProps {
  lastSaved: string | null;
  className?: string;
}

export function DraftIndicator({ lastSaved, className = "" }: DraftIndicatorProps) {
  if (!lastSaved) return null;
  
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <Cloud className="w-3 h-3 text-green-500" />
      <span>Draft saved {lastSaved}</span>
    </div>
  );
}

interface RestorePromptProps {
  onRestore: () => void;
  onDiscard: () => void;
}

export function RestorePrompt({ onRestore, onDiscard }: RestorePromptProps) {
  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
      <CloudOff className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-blue-800 dark:text-blue-200">
          You have an unsaved draft from your previous session.
        </span>
        <div className="flex gap-2 ml-4">
          <Button size="sm" variant="outline" onClick={onRestore} className="h-7">
            <RotateCcw className="w-3 h-3 mr-1" />
            Restore
          </Button>
          <Button size="sm" variant="ghost" onClick={onDiscard} className="h-7 text-muted-foreground">
            <Trash2 className="w-3 h-3 mr-1" />
            Discard
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
