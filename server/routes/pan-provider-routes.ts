import { Router, Request, Response } from 'express';

const router = Router();

interface PANProviderConfig {
  provider: string;
  name: string;
  description: string;
  pricePerVerification: number;
  isActive: boolean;
  isConfigured: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  features: string[];
}

const PAN_PROVIDERS: PANProviderConfig[] = [
  {
    provider: 'cashfree',
    name: 'Cashfree Verification Suite',
    description: 'PAN verification via Cashfree API with name match scoring, Aadhaar seeding status, and corporate PAN support',
    pricePerVerification: 2.50,
    isActive: true,
    isConfigured: false,
    requiredEnvVars: ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY'],
    missingEnvVars: [],
    features: ['Name Match Scoring', 'Aadhaar Seeding Status', 'Corporate PAN', 'Real-time API', 'Sandbox Testing'],
  },
  {
    provider: 'sandbox',
    name: 'Sandbox.co.in PAN API',
    description: 'Government-sourced PAN verification via Sandbox.co.in with detailed taxpayer info and compliance data',
    pricePerVerification: 1.80,
    isActive: false,
    isConfigured: false,
    requiredEnvVars: ['SANDBOX_API_KEY', 'SANDBOX_API_SECRET'],
    missingEnvVars: [],
    features: ['Government Data Source', 'Taxpayer Category', 'Last Name Match', 'Compliance Check', 'Bulk Verification'],
  },
  {
    provider: 'truthscreen',
    name: 'TruthScreen PAN Verification',
    description: 'NSDL-backed PAN verification with comprehensive identity validation and fraud detection',
    pricePerVerification: 3.00,
    isActive: false,
    isConfigured: false,
    requiredEnvVars: ['TRUTHSCREEN_USERNAME', 'TRUTHSCREEN_PASSWORD'],
    missingEnvVars: [],
    features: ['NSDL Direct', 'Fraud Detection', 'Identity Validation', 'Historical Records', 'Enterprise SLA'],
  },
];

let activeProvider = 'cashfree';
let providerPricing: Record<string, number> = {
  cashfree: 2.50,
  sandbox: 1.80,
  truthscreen: 3.00,
};

function getProviders(): PANProviderConfig[] {
  return PAN_PROVIDERS.map(p => {
    const missingEnvVars = p.requiredEnvVars.filter(v => !process.env[v]);
    return {
      ...p,
      pricePerVerification: providerPricing[p.provider] ?? p.pricePerVerification,
      isActive: p.provider === activeProvider,
      isConfigured: missingEnvVars.length === 0,
      missingEnvVars,
    };
  });
}

router.get('/providers', async (_req: Request, res: Response) => {
  try {
    const providers = getProviders();
    res.json({
      success: true,
      activeProvider,
      providers,
    });
  } catch (error) {
    console.error('[PAN Provider Routes] Error fetching providers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch PAN providers' });
  }
});

router.post('/set-provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    if (!provider || !PAN_PROVIDERS.find(p => p.provider === provider)) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    const providerConfig = getProviders().find(p => p.provider === provider);
    if (!providerConfig?.isConfigured) {
      return res.status(400).json({ success: false, error: 'Provider is not configured. Please add the required environment variables first.' });
    }
    activeProvider = provider;
    res.json({ success: true, activeProvider: provider });
  } catch (error) {
    console.error('[PAN Provider Routes] Error setting provider:', error);
    res.status(500).json({ success: false, error: 'Failed to set PAN provider' });
  }
});

router.patch('/pricing', async (req: Request, res: Response) => {
  try {
    const { provider, pricePerVerification } = req.body;
    if (!provider || !PAN_PROVIDERS.find(p => p.provider === provider)) {
      return res.status(400).json({ success: false, error: 'Invalid provider' });
    }
    if (typeof pricePerVerification !== 'number' || pricePerVerification < 0) {
      return res.status(400).json({ success: false, error: 'Invalid price' });
    }
    providerPricing[provider] = pricePerVerification;
    res.json({ success: true, provider, pricePerVerification });
  } catch (error) {
    console.error('[PAN Provider Routes] Error updating pricing:', error);
    res.status(500).json({ success: false, error: 'Failed to update PAN pricing' });
  }
});

router.get('/usage', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      stats: {
        totalVerifications: 0,
        successfulVerifications: 0,
        failedVerifications: 0,
        successRate: 0,
        totalCost: 0,
        thisMonth: { verifications: 0, cost: 0 },
        byProvider: {},
      },
      mockData: true,
      note: 'Usage tracking will populate as verifications are processed',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch usage stats' });
  }
});

export default router;
