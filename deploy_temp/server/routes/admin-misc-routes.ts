import { Express } from 'express';
import { requireAdmin } from '../middleware/roleMiddleware';
import { whatsappService } from '../whatsapp';
import { storage } from '../storage';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { adminSettings } from '@shared/schema';
import { calculateFintekProRating } from '../utils/mf-rating-utils';

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
// Helper function to check if user has any of the specified roles


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
  // Migration: Update User-Friendly ID for a specific user
  app.post('/api/admin/migrate-user-id', requireAdmin, async (req, res) => {
    try {
      const { email, newUserId } = req.body;
      if (!email || !newUserId) {
        return res.status(400).json({ success: false, error: 'email and newUserId are required' });
      }

      const { users } = await import('@shared/schema');
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await db.update(users)
        .set({ userId: newUserId })
        .where(eq(users.id, user.id));

      res.json({ success: true, message: `Updated user ${email} to ID ${newUserId}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
