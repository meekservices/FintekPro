import { Router } from "express";
import { webauthnService } from "../services/webauthn-service";
import { authEventBus, type RiskLevel } from "../services/auth-event-bus";

const router = Router();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
  next();
}

router.post("/register/options", requireAuth, async (req, res) => {
  try {
    const userId: string = req.user!.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(`reg:${userId}`, 5, 60_000)) {
      return res.status(429).json({ error: "Too many registration attempts. Please wait." });
    }

    const user = req.user as any;
    const options = await webauthnService.getRegistrationOptions(
      userId,
      user.email || user.username || userId,
      user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user.email || userId)
    );

    res.json(options);
  } catch (err: any) {
    console.error("[WebAuthn] Registration options error:", err);
    res.status(500).json({ error: err.message || "Failed to generate registration options" });
  }
});

router.post("/register/verify", requireAuth, async (req, res) => {
  try {
    const userId: string = req.user!.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"];

    if (!checkRateLimit(`reg_verify:${userId}`, 5, 60_000)) {
      return res.status(429).json({ error: "Too many attempts. Please wait." });
    }

    const credential = await webauthnService.verifyRegistration(userId, req.body, ip, ua);

    authEventBus.emit("CREDENTIAL_ENROLLED", {
      userId,
      ip,
      credentialId: credential.id,
      deviceType: credential.deviceType || "unknown",
      deviceName: credential.deviceType === "platform" ? "Platform Authenticator" : "Security Key",
    });

    res.json({ success: true, credentialId: credential.id, deviceType: credential.deviceType });
  } catch (err: any) {
    console.error("[WebAuthn] Registration verify error:", err);
    res.status(400).json({ error: err.message || "Registration verification failed" });
  }
});

router.post("/authenticate/options", requireAuth, async (req, res) => {
  try {
    const userId: string = req.user!.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(`auth:${userId}:${ip}`, 10, 60_000)) {
      return res.status(429).json({ error: "Too many authentication attempts. Please try later." });
    }

    const options = await webauthnService.getAuthenticationOptions(userId);
    res.json(options);
  } catch (err: any) {
    console.error("[WebAuthn] Auth options error:", err);
    res.status(400).json({ error: err.message || "Failed to generate authentication options" });
  }
});

router.post("/authenticate/verify", requireAuth, async (req, res) => {
  try {
    const userId: string = req.user!.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const ua = req.headers["user-agent"];

    if (!checkRateLimit(`auth_verify:${userId}:${ip}`, 10, 60_000)) {
      return res.status(429).json({ error: "Too many attempts. Please wait." });
    }

    const { riskContext, ...response } = req.body;
    const result = await webauthnService.verifyAuthentication(userId, response, ip, ua, riskContext);

    (req.session as any).biometricVerifiedAt = new Date().toISOString();
    req.session!.save(() => {});

    authEventBus.emit("AUTH_SUCCESS", {
      userId,
      ip,
      ua,
      credentialId: result.credentialId,
      riskScore: result.risk.score,
      riskLevel: result.risk.level as RiskLevel,
    });

    if (result.risk.stepUpRequired !== "none") {
      authEventBus.emit("AUTH_STEPUP_REQUIRED", {
        userId,
        ip,
        stepUpType: result.risk.stepUpRequired,
        riskScore: result.risk.score,
        riskLevel: result.risk.level as RiskLevel,
      });
    }

    if (result.risk.level === "HIGH" || result.risk.level === "CRITICAL") {
      authEventBus.emit("HIGH_RISK_TXN", {
        userId,
        ip,
        riskScore: result.risk.score,
        riskLevel: result.risk.level as RiskLevel,
        reason: `Risk factors: ${Object.keys(result.risk.factors || {}).join(", ") || "elevated score"}`,
      });
    }

    res.json({
      success: true,
      risk: result.risk,
      stepUpRequired: result.risk.stepUpRequired !== "none" ? result.risk.stepUpRequired : null,
    });
  } catch (err: any) {
    console.error("[WebAuthn] Auth verify error:", err);
    res.status(400).json({ error: err.message || "Authentication verification failed" });
  }
});

router.get("/credentials", requireAuth, async (req, res) => {
  try {
    const credentials = await webauthnService.listCredentials(req.user!.id);
    res.json({ credentials });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/credentials/:id", requireAuth, async (req, res) => {
  try {
    const { deviceName } = req.body;
    if (!deviceName?.trim()) return res.status(400).json({ error: "Device name required" });
    const updated = await webauthnService.renameCredential(req.user!.id, req.params.id, deviceName.trim());
    if (!updated) return res.status(404).json({ error: "Credential not found" });
    res.json({ success: true, credential: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/credentials/:id", requireAuth, async (req, res) => {
  try {
    const userId: string = req.user!.id;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const deleted = await webauthnService.deleteCredential(userId, req.params.id, ip);
    if (!deleted) return res.status(404).json({ error: "Credential not found" });

    authEventBus.emit("CREDENTIAL_DELETED", {
      userId,
      ip,
      credentialId: req.params.id,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/audit-log", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const logs = await webauthnService.getAuditLog(req.user!.id, limit);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/status", requireAuth, async (req, res) => {
  try {
    const hasCredentials = await webauthnService.hasCredentials(req.user!.id);
    const sessionFlag = (req.session as any)?.biometricVerifiedAt;
    const isVerified = sessionFlag && Date.now() - new Date(sessionFlag).getTime() < 15 * 60 * 1000;
    res.json({ enrolled: hasCredentials, sessionVerified: !!isVerified });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as webauthnRouter };
