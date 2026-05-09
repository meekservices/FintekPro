import { authEventBus } from "./auth-event-bus";
import { db } from "../db";
import { webauthnAuditLog } from "../../shared/schema";

export function registerAuthEventConsumers(): void {
  authEventBus.on("AUTH_SUCCESS", (payload) => {
    console.log(
      `[AUTH_EVENT] AUTH_SUCCESS | user=${payload.userId} ip=${payload.ip} ` +
      `risk=${payload.riskLevel}(${payload.riskScore}) signCount=${payload.signCount ?? "n/a"} ` +
      `credential=${payload.credentialId.slice(0, 16)}...`
    );
  });

  authEventBus.on("AUTH_STEPUP_REQUIRED", (payload) => {
    console.warn(
      `[AUTH_EVENT][STEP_UP] AUTH_STEPUP_REQUIRED | user=${payload.userId} ip=${payload.ip} ` +
      `type=${payload.stepUpType} risk=${payload.riskLevel}(${payload.riskScore})`
    );
  });

  authEventBus.on("HIGH_RISK_TXN", async (payload) => {
    console.error(
      `[AUTH_EVENT][HIGH_RISK] HIGH_RISK_TXN | user=${payload.userId} ip=${payload.ip} ` +
      `risk=${payload.riskLevel}(${payload.riskScore}) reason="${payload.reason}"`
    );
    try {
      await db.insert(webauthnAuditLog).values({
        userId: payload.userId,
        event: "HIGH_RISK_ALERT",
        credentialId: null,
        ipAddress: payload.ip,
        userAgent: undefined,
        deviceType: undefined,
        riskScore: payload.riskScore,
        riskFactors: { reason: payload.reason },
        stepUpRequired: undefined,
        success: false,
        failureReason: `High-risk auth event: ${payload.reason} (level=${payload.riskLevel})`,
      });
    } catch (e) {
      console.error("[AUTH_EVENT] Failed to persist HIGH_RISK_TXN to audit log:", e);
    }
  });

  authEventBus.on("CREDENTIAL_ENROLLED", (payload) => {
    console.log(
      `[AUTH_EVENT][ENROLLED] CREDENTIAL_ENROLLED | user=${payload.userId} ip=${payload.ip} ` +
      `type=${payload.deviceType} name="${payload.deviceName}" credential=${payload.credentialId.slice(0, 16)}...`
    );
  });

  authEventBus.on("CREDENTIAL_DELETED", (payload) => {
    console.log(
      `[AUTH_EVENT][DELETED] CREDENTIAL_DELETED | user=${payload.userId} ip=${payload.ip} ` +
      `credential=${payload.credentialId.slice(0, 16)}...`
    );
  });

  console.log("✅ Auth event consumers registered (5 handlers active)");
}
