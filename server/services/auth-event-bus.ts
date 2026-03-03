import { EventEmitter } from "events";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type StepUpType = "none" | "biometric" | "biometric_otp";

export interface AuthSuccessPayload {
  userId: string;
  ip: string;
  ua: string | undefined;
  credentialId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  signCount?: number;
}

export interface AuthStepUpPayload {
  userId: string;
  ip: string;
  stepUpType: StepUpType;
  riskScore: number;
  riskLevel: RiskLevel;
}

export interface HighRiskTxnPayload {
  userId: string;
  ip: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
}

export interface CredentialEnrolledPayload {
  userId: string;
  ip: string;
  credentialId: string;
  deviceType: string;
  deviceName: string;
}

export interface CredentialDeletedPayload {
  userId: string;
  ip: string;
  credentialId: string;
}

type AuthEventMap = {
  AUTH_SUCCESS: [AuthSuccessPayload];
  AUTH_STEPUP_REQUIRED: [AuthStepUpPayload];
  HIGH_RISK_TXN: [HighRiskTxnPayload];
  CREDENTIAL_ENROLLED: [CredentialEnrolledPayload];
  CREDENTIAL_DELETED: [CredentialDeletedPayload];
};

class AuthEventBus extends EventEmitter {
  emit<K extends keyof AuthEventMap>(event: K, payload: AuthEventMap[K][0]): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends keyof AuthEventMap>(event: K, listener: (payload: AuthEventMap[K][0]) => void): this {
    return super.on(event as string, listener);
  }

  once<K extends keyof AuthEventMap>(event: K, listener: (payload: AuthEventMap[K][0]) => void): this {
    return super.once(event as string, listener);
  }

  off<K extends keyof AuthEventMap>(event: K, listener: (payload: AuthEventMap[K][0]) => void): this {
    return super.off(event as string, listener);
  }
}

export const authEventBus = new AuthEventBus();
console.log("✅ Auth Event Bus initialized (AUTH_SUCCESS | AUTH_STEPUP_REQUIRED | HIGH_RISK_TXN | CREDENTIAL_ENROLLED | CREDENTIAL_DELETED)");
