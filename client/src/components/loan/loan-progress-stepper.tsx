import { CheckCircle2, Clock, ArrowRight, Building, FileCheck, AlertCircle, XCircle } from "lucide-react";

interface LoanProgressStepperProps {
  status: string;
  compact?: boolean;
}

const stages = [
  { key: "submitted", label: "Submitted", icon: Clock },
  { key: "eligibility_check", label: "Eligibility Check", icon: AlertCircle },
  { key: "routed", label: "Bank Routing", icon: ArrowRight },
  { key: "in_review", label: "Under Review", icon: Building },
  { key: "decision", label: "Decision", icon: CheckCircle2 },
];

const statusOrder: Record<string, number> = {
  draft: 0,
  submitted: 1,
  eligibility_check: 2,
  routed: 3,
  pending_with_banks: 3,
  in_review: 4,
  decision: 5,
  approved: 5,
  disbursed: 5,
  rejected: 5,
  withdrawn: 5,
  expired: 5,
};

export function LoanProgressStepper({ status, compact = false }: LoanProgressStepperProps) {
  const currentStep = statusOrder[status] ?? 0;
  const isTerminal = status === "rejected" || status === "withdrawn" || status === "expired";
  const isSuccess = status === "approved" || status === "disbursed";

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {stages.map((stage, index) => {
          const stepNum = statusOrder[stage.key];
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isRejected = isTerminal && isCurrent;
          
          return (
            <div key={stage.key} className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isRejected
                    ? "bg-red-500"
                    : isComplete || (isSuccess && index <= stages.length - 1)
                    ? "bg-green-500"
                    : isCurrent
                    ? "bg-blue-500 animate-pulse"
                    : "bg-muted"
                }`}
              />
              {index < stages.length - 1 && (
                <div
                  className={`w-3 h-0.5 ${
                    isComplete ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted -z-10" />
        
        {stages.map((stage, index) => {
          const stepNum = statusOrder[stage.key];
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isRejected = isTerminal && stage.key === "decision";
          const Icon = stage.icon;
          
          return (
            <div key={stage.key} className="flex flex-col items-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isRejected
                    ? "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
                    : isComplete || (isSuccess && index <= stages.length - 1)
                    ? "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
                    : isCurrent
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500 ring-offset-2"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete && !isRejected ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isRejected ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium text-center max-w-[60px] ${
                  isComplete || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {stage.key === "decision" && isSuccess ? "Approved" : 
                 stage.key === "decision" && isRejected ? "Rejected" :
                 stage.key === "decision" && status === "withdrawn" ? "Withdrawn" :
                 stage.key === "decision" && status === "expired" ? "Expired" :
                 stage.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {status === "disbursed" && (
        <div className="mt-3 text-center">
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Loan Disbursed Successfully
          </span>
        </div>
      )}
      
      {isTerminal && status !== "approved" && (
        <div className="mt-3 text-center">
          <span className={`text-sm font-medium ${
            status === "rejected" ? "text-red-600 dark:text-red-400" :
            status === "withdrawn" ? "text-orange-600 dark:text-orange-400" :
            "text-muted-foreground"
          }`}>
            {status === "rejected" ? "Application Rejected" :
             status === "withdrawn" ? "Application Withdrawn" :
             "Application Expired"}
          </span>
        </div>
      )}
    </div>
  );
}

export const loanTypeProcessingTime: Record<string, { min: number; max: number; label: string }> = {
  personal: { min: 2, max: 5, label: "2-5 business days" },
  home: { min: 7, max: 15, label: "7-15 business days" },
  car: { min: 3, max: 7, label: "3-7 business days" },
  business: { min: 10, max: 20, label: "10-20 business days" },
  education: { min: 5, max: 10, label: "5-10 business days" },
  gold: { min: 1, max: 2, label: "1-2 business days" },
  lap: { min: 10, max: 15, label: "10-15 business days" },
};

interface ProcessingTimeDisplayProps {
  loanType: string;
  className?: string;
}

export function ProcessingTimeDisplay({ loanType, className = "" }: ProcessingTimeDisplayProps) {
  const timing = loanTypeProcessingTime[loanType];
  if (!timing) return null;
  
  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <Clock className="w-4 h-4" />
      <span>Estimated processing: <strong className="text-foreground">{timing.label}</strong></span>
    </div>
  );
}
