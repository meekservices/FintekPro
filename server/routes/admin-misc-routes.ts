import { Express } from 'express';
import { requireAdmin } from '../middleware/roleMiddleware';
import { whatsappService } from '../whatsapp';
import { storage } from '../storage';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { adminSettings } from '@shared/schema';

export function registerAdminMiscRoutes(app: Express): void {
// WhatsApp Web admin endpoints (requireAdmin is now in scope)
app.get('/api/admin/whatsapp/qr', requireAdmin, (_req, res) => {
  const status = whatsappService.getStatus();
  if (status.isReady) {
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2 style="color:#25d366">✅ WhatsApp Connected</h2>
      <p>The WhatsApp client is already authenticated and ready.</p>
    </body></html>`);
  }
  const dataUrl = whatsappService.getQrCodeDataUrl();
  if (!dataUrl) {
    return res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>⏳ QR Code Not Ready</h2>
      <p>WhatsApp is initializing. Refresh in 5–10 seconds.</p>
      <script>setTimeout(()=>location.reload(),5000)</script>
    </body></html>`);
  }
  res.send(`<!DOCTYPE html><html><head><title>WhatsApp QR</title></head>
    <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f0fdf4">
      <h2 style="color:#128c7e">📱 Scan to Link WhatsApp</h2>
      <p>Open WhatsApp → Linked Devices → Link a Device, then scan below.</p>
      <img src="${dataUrl}" style="border:4px solid #25d366;border-radius:12px" />
      <p style="color:#666;font-size:13px">QR codes expire in ~60 s — page auto-refreshes every 30 s</p>
      <script>setTimeout(()=>location.reload(),30000)</script>
    </body></html>`);
});

app.get('/api/admin/whatsapp/status', requireAdmin, (_req, res) => {
  const status = whatsappService.getStatus();
  const dataUrl = whatsappService.getQrCodeDataUrl();
  res.json({ ...status, qrDataUrl: dataUrl });
});

app.post('/api/admin/whatsapp/init', requireAdmin, async (_req, res) => {
  try {
    await whatsappService.initialize();
    res.json({ success: true, message: 'WhatsApp initialization started — visit /api/admin/whatsapp/qr to scan' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Read global OTP channel priority
app.get('/api/admin/settings/otp-priority', requireAdmin, async (_req, res) => {
  try {
    const { adminSettings } = await import('@shared/schema');
    const setting = await db.query.adminSettings.findFirst({
      where: eq(adminSettings.key, 'otp_channel_priority'),
    });
    const channels = (setting?.value as string[] | null) || ['email', 'whatsapp', 'sms'];
    res.json({ success: true, channels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update global OTP channel priority
app.put('/api/admin/settings/otp-priority', requireAdmin, async (req, res) => {
  try {
    const { channels } = req.body;
    const valid = ['email', 'whatsapp', 'sms'];
    if (!Array.isArray(channels) || channels.length === 0 || !channels.every(c => valid.includes(c))) {
      return res.status(400).json({ success: false, error: 'channels must be a non-empty array of email/whatsapp/sms' });
    }
    const unique = [...new Set(channels)];
    if (unique.length !== 3) {
      return res.status(400).json({ success: false, error: 'All three channels (email, whatsapp, sms) must be present exactly once' });
    }
    const { adminSettings } = await import('@shared/schema');
    const existing = await db.query.adminSettings.findFirst({
      where: eq(adminSettings.key, 'otp_channel_priority'),
    });
    if (existing) {
      await db.update(adminSettings)
        .set({ value: unique, updatedAt: new Date(), updatedBy: (req as any).user?.id })
        .where(eq(adminSettings.key, 'otp_channel_priority'));
    } else {
      await db.insert(adminSettings).values({
        key: 'otp_channel_priority',
        value: unique,
        description: 'Global OTP delivery channel priority order (email/whatsapp/sms)',
        updatedBy: (req as any).user?.id,
      });
    }
    res.json({ success: true, channels: unique });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Basic user authentication middleware - uses session auth
const authenticateUser = async (req: any, res: any, next: any) => {
  // Check if user is authenticated via session (Passport.js)
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  
  // Fallback: check Authorization header for API calls
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // For API token auth, verify against session or reject
  return res.status(401).json({ error: "Please sign in to access this resource" });
};
// Helper function to calculate FintekPro Smart Rating based on fund metrics
// Rating: 1 = Exceptional, 2 = Good, 3 = Average, 4 = Below Average, 5 = Poor
const calculateFintekProRating = (fund: any): number => {
  let score = 0;
  let factors = 0;
  
  // Factor 1: 1-year returns (40% weight)
  const returns1y = parseFloat(fund.returns1y || '0');
  if (returns1y > 25) score += 40 * 1;
  else if (returns1y > 15) score += 40 * 0.8;
  else if (returns1y > 10) score += 40 * 0.6;
  else if (returns1y > 5) score += 40 * 0.4;
  else if (returns1y > 0) score += 40 * 0.2;
  factors += 40;
  
  // Factor 2: Risk level (30% weight) - lower risk = higher score for conservative investors
  const riskLevel = (fund.riskLevel || '').toLowerCase();
  if (riskLevel.includes('low')) score += 30 * 0.6;
  else if (riskLevel.includes('moderate')) score += 30 * 0.8;
  else if (riskLevel.includes('high')) score += 30 * 0.5;
  else score += 30 * 0.5; // Default moderate
  factors += 30;
  
  // Factor 3: Category bonus (15% weight)
  const category = (fund.category || '').toLowerCase();
  if (category.includes('equity')) score += 15 * 0.7;
  else if (category.includes('debt') || category.includes('bond')) score += 15 * 0.6;
  else if (category.includes('hybrid')) score += 15 * 0.8;
  else if (category.includes('index')) score += 15 * 0.65;
  else score += 15 * 0.5;
  factors += 15;
  
  // Factor 4: AUM presence (15% weight)
  const aum = parseFloat(fund.aum || '0');
  if (aum > 10000) score += 15 * 1;
  else if (aum > 5000) score += 15 * 0.8;
  else if (aum > 1000) score += 15 * 0.6;
  else score += 15 * 0.4;
  factors += 15;
  
  // Calculate final rating (1-5 scale)
  const normalizedScore = score / factors;
  if (normalizedScore >= 0.8) return 1;
  if (normalizedScore >= 0.6) return 2;
  if (normalizedScore >= 0.4) return 3;
  if (normalizedScore >= 0.2) return 4;
  return 5;
};


// Helper function to check if user has any of the specified roles
const hasRole = (user: any, requiredRoles: string[]): boolean => {
  if (!user) return false;
  
  // Support both old single role field and new roles array for backwards compatibility
  const userRoles = user.roles || (user.role ? [user.role] : []);
  return requiredRoles.some(role => userRoles.includes(role));
};

// Agent middleware - requires user to be authenticated with 'agent' or 'admin' role
const requireAgent = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Agent, partner, or admin access required" });
  }
  
  next();
};

const requireClientOrHigher = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['user', 'client', 'business_client', 'agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Client access required" });
  }
  
  next();
};

// Helper function to generate custom proposal IDs based on source
const generateProposalId = (source: 'ai' | 'agent' | 'client' | 'hybrid'): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  switch (source) {
    case 'ai':
      return `AI-${timestamp}-${randomSuffix}`;
    case 'agent':
      return `AGENT-${timestamp}-${randomSuffix}`;
    case 'client':
      return `CLIENT-${timestamp}-${randomSuffix}`;
    case 'hybrid':
      return `HYBRID-${timestamp}-${randomSuffix}`;
    default:
      return `PROPOSAL-${timestamp}-${randomSuffix}`;
  }
};


}
