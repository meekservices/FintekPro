import { useState, useEffect } from "react";
import { useKycStatus } from "@/hooks/useKycStatus";
import { useAuth } from "@/hooks/useAuth";
import { KycGateModal } from "./kyc-gate-modal";

interface KycGateProps {
  children: React.ReactNode;
  showModal?: boolean;
}

export function KycGate({ children, showModal = true }: KycGateProps) {
  const { isAuthenticated } = useAuth();
  const { isKycCompleted, needsKyc, isLoading } = useKycStatus();
  const [modalOpen, setModalOpen] = useState(false);

  // Open modal when user needs KYC - moved to useEffect to avoid render-time state updates
  useEffect(() => {
    if (showModal && needsKyc && !isKycCompleted) {
      setModalOpen(true);
    }
  }, [showModal, needsKyc, isKycCompleted]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !needsKyc) {
    return <>{children}</>;
  }

  if (isKycCompleted) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="relative">
        <div className="pointer-events-none opacity-60 select-none">
          {children}
        </div>
        {showModal && (
          <KycGateModal 
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        )}
      </div>
    </>
  );
}
