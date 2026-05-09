import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, User, Plane, ArrowRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CorporateKYCWizard } from "./corporate-kyc-wizard";
import { NRIKYCWizard } from "./nri-kyc-wizard";
import { MultiStepKYCWizard } from "./multi-step-kyc-wizard";
import { motion } from "framer-motion";

export interface KYCProgress {
  isCompleted?: boolean;
  currentStep?: number;
  [key: string]: any;
}

type KYCType = "individual" | "corporate" | "nri" | null;

interface KYCTypeCardProps {
  type: KYCType;
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  selected: boolean;
  onClick: () => void;
  completed?: boolean;
  inProgress?: boolean;
}

function KYCTypeCard({ type, title, description, icon: Icon, features, selected, onClick, completed, inProgress }: KYCTypeCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-lg relative",
        selected && "ring-2 ring-primary",
        completed && "bg-green-50 dark:bg-green-950/20"
      )}
      onClick={onClick}
      data-testid={`kyc-type-${type}`}
    >
      {completed && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
          <CheckCircle className="h-4 w-4" />
        </div>
      )}
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            selected ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="text-sm flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
        {inProgress && (
          <p className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">
            ⏳ Resume in Progress
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function KYCTypeSelector() {
  const [selectedType, setSelectedType] = useState<KYCType>(null);
  const [isStarted, setIsStarted] = useState(false);

  // Check for incomplete KYC progress on mount
  const { data: individualProgress } = useQuery<KYCProgress>({
    queryKey: ["/api/kyc/smart/progress"],
    enabled: !isStarted
  });

  const { data: corporateProgress } = useQuery<KYCProgress>({
    queryKey: ["/api/kyc/corporate/progress"],
    enabled: !isStarted
  });

  const { data: nriProgress } = useQuery<KYCProgress>({
    queryKey: ["/api/kyc/nri/progress"],
    enabled: !isStarted
  });

  // Auto-resume incomplete KYC
  useEffect(() => {
    if (individualProgress && !individualProgress.isCompleted && individualProgress.currentStep > 0) {
      setSelectedType("individual");
      setIsStarted(true);
    } else if (corporateProgress && !corporateProgress.isCompleted && corporateProgress.currentStep > 0) {
      setSelectedType("corporate");
      setIsStarted(true);
    } else if (nriProgress && !nriProgress.isCompleted && nriProgress.currentStep > 0) {
      setSelectedType("nri");
      setIsStarted(true);
    }
  }, [individualProgress, corporateProgress, nriProgress]);

  const kycTypes = [
    {
      type: "individual" as KYCType,
      title: "Individual / Resident Indian",
      description: "For Indian residents and individuals",
      icon: User,
      features: [
        "PAN + DOB verification",
        "Aadhaar via DigiLocker",
        "Auto bank/demat discovery",
        "Fastest verification (4 steps)"
      ],
      completed: individualProgress?.isCompleted,
      inProgress: individualProgress?.currentStep > 0 && !individualProgress?.isCompleted
    },
    {
      type: "corporate" as KYCType,
      title: "Corporate / Company",
      description: "For companies and non-individual entities",
      icon: Building2,
      features: [
        "Corporate PAN verification",
        "Company documents (COI, MOA, AOA)",
        "Authorized signatory verification",
        "Corporate account discovery"
      ],
      completed: corporateProgress?.isCompleted,
      inProgress: corporateProgress?.currentStep > 0 && !corporateProgress?.isCompleted
    },
    {
      type: "nri" as KYCType,
      title: "NRI / Non-Resident Indian",
      description: "For Indians residing abroad",
      icon: Plane,
      features: [
        "Passport + optional PAN verification",
        "Overseas address proof",
        "PIS permission & foreign bank details",
        "FATCA/CRS tax compliance"
      ],
      completed: nriProgress?.isCompleted,
      inProgress: nriProgress?.currentStep > 0 && !nriProgress?.isCompleted
    }
  ];

  if (isStarted && selectedType) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8">
          <Button
            variant="ghost"
            onClick={() => {
              setIsStarted(false);
              setSelectedType(null);
            }}
            className="mb-6"
            data-testid="button-back-to-selector"
          >
            ← Back to KYC Type Selection
          </Button>
          
          {selectedType === "individual" && <MultiStepKYCWizard />}
          {selectedType === "corporate" && <CorporateKYCWizard />}
          {selectedType === "nri" && <NRIKYCWizard />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Complete Your KYC Verification</h1>
          <p className="text-lg text-muted-foreground">
            Choose your account type to start the verification process
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {kycTypes.map((kycType) => (
            <KYCTypeCard
              key={kycType.type}
              {...kycType}
              selected={selectedType === kycType.type}
              onClick={() => setSelectedType(kycType.type)}
            />
          ))}
        </div>

        {selectedType && (
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => setIsStarted(true)}
              className="min-w-[200px]"
              data-testid="button-start-kyc"
            >
              Start {kycTypes.find((k: any) => k.type === selectedType)?.title} KYC
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
