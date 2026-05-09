import { Router, Request, Response } from 'express';
import { db } from '../db';
import { adminSettings } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export async function ensureAdminSettingsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR NOT NULL UNIQUE,
        value JSONB,
        description TEXT,
        updated_by VARCHAR,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[KYC Flow Routes] Failed to ensure admin_settings table:', err);
  }
}

const router = Router();

const SETTINGS_KEY = 'kyc_flow_config_overrides';

export interface KycStepProvider {
  providerId: string;
  providerName: string;
  priority: number;
  isConfigured: boolean;
  pricePerCall: number;
  features: string[];
}

export interface KycStep {
  stepId: string;
  stepName: string;
  description: string;
  regulatoryBasis: string;
  requiredFor: string[];
  providers: KycStepProvider[];
}

const kycFlowConfig: KycStep[] = [
  {
    stepId: 'pan_verification',
    stepName: 'PAN Verification',
    description: 'Permanent Account Number verification against NSDL/UTI database for identity and tax compliance',
    regulatoryBasis: 'SEBI KYC Regulations 2011, Income Tax Act Section 139A, PMLA 2002',
    requiredFor: ['All Financial Products', 'Mutual Funds', 'Stocks', 'Bonds', 'Insurance', 'Loans'],
    providers: [
      { providerId: 'sandbox', providerName: 'Sandbox.co.in PAN API', priority: 1, isConfigured: false, pricePerCall: 1.80, features: ['Government Source', 'Taxpayer Category', 'Bulk Verification'] },
      { providerId: 'truthscreen', providerName: 'TruthScreen PAN', priority: 2, isConfigured: false, pricePerCall: 3.00, features: ['NSDL Direct', 'Fraud Detection', 'Enterprise SLA'] },
      { providerId: 'cashfree', providerName: 'Cashfree PAN Verification', priority: 3, isConfigured: false, pricePerCall: 2.50, features: ['Name Match Scoring', 'Aadhaar Seeding Status', 'Corporate PAN'] },
    ],
  },
  {
    stepId: 'aadhaar_verification',
    stepName: 'Aadhaar Verification',
    description: 'UIDAI-compliant Aadhaar identity verification via OTP-based eKYC or Offline XML',
    regulatoryBasis: 'Aadhaar Act 2016, SEBI Circular SEBI/HO/MIRSD/DOP/CIR/P/2019/42, RBI Master Direction KYC',
    requiredFor: ['Mutual Funds', 'Demat Account', 'Bank Account', 'Insurance', 'Loans'],
    providers: [
      { providerId: 'cashfree', providerName: 'Cashfree Aadhaar OKYC', priority: 1, isConfigured: false, pricePerCall: 4.00, features: ['Aadhaar OTP', 'eKYC Data', 'Photo Retrieval'] },
      { providerId: 'truthscreen', providerName: 'TruthScreen Aadhaar eKYC', priority: 2, isConfigured: false, pricePerCall: 3.00, features: ['Aadhaar OTP', 'PAN-Aadhaar Linkage', 'Aadhaar Validation'] },
      { providerId: 'sandbox', providerName: 'Sandbox.co.in Aadhaar API', priority: 3, isConfigured: false, pricePerCall: 2.50, features: ['Government Source', 'Bulk Verification'] },
      { providerId: 'offline_xml', providerName: 'Aadhaar Offline XML', priority: 4, isConfigured: true, pricePerCall: 0.00, features: ['No API Cost', 'Offline Processing', 'UIDAI Compliant'] },
    ],
  },
  {
    stepId: 'address_verification',
    stepName: 'Address Verification',
    description: 'Current and permanent address verification via utility bills, Aadhaar, or physical verification',
    regulatoryBasis: 'RBI Master Direction KYC, SEBI KYC Regulations 2011, PMLA 2002 Rule 9',
    requiredFor: ['Bank Account', 'Demat Account', 'Loans', 'Insurance'],
    providers: [
      { providerId: 'aadhaar_address', providerName: 'Aadhaar Address (via eKYC)', priority: 1, isConfigured: false, pricePerCall: 0.00, features: ['Auto from Aadhaar eKYC', 'No Extra Cost', 'UIDAI Verified'] },
      { providerId: 'digilocker', providerName: 'DigiLocker Address Proof', priority: 2, isConfigured: false, pricePerCall: 0.00, features: ['Government Issued', 'Digital Documents', 'Free API'] },
      { providerId: 'manual_upload', providerName: 'Manual Document Upload', priority: 3, isConfigured: true, pricePerCall: 0.00, features: ['Utility Bills', 'Bank Statement', 'Passport'] },
    ],
  },
  {
    stepId: 'bank_verification',
    stepName: 'Bank Account Verification',
    description: 'Bank account ownership verification via penny drop or IFSC validation',
    regulatoryBasis: 'RBI Account Aggregator Framework, SEBI Circular for Direct Plan MF, NPCI Guidelines',
    requiredFor: ['Mutual Funds', 'Insurance', 'Loans', 'Direct Equity'],
    providers: [
      { providerId: 'cashfree_bank', providerName: 'Cashfree Bank Verification', priority: 1, isConfigured: false, pricePerCall: 1.50, features: ['Penny Drop', 'IFSC Validation', 'Real-time'] },
      { providerId: 'sandbox_bank', providerName: 'Sandbox.co.in Bank API', priority: 2, isConfigured: false, pricePerCall: 1.20, features: ['Account Validation', 'IFSC Lookup', 'Bulk Support'] },
      { providerId: 'manual_cheque', providerName: 'Cancelled Cheque Upload', priority: 3, isConfigured: true, pricePerCall: 0.00, features: ['Manual Verification', 'No API Cost'] },
    ],
  },
  {
    stepId: 'ckyc_verification',
    stepName: 'CKYC (Central KYC)',
    description: 'Central KYC Registry lookup via CERSAI for regulated financial products - mandatory for MF/PMS/AIF per SEBI',
    regulatoryBasis: 'SEBI Circular CIR/MIRSD/66/2016, CERSAI CKYC Guidelines, KRA Regulations',
    requiredFor: ['Mutual Funds', 'PMS', 'AIF', 'Demat Account'],
    providers: [
      { providerId: 'truthscreen_ckyc', providerName: 'TruthScreen CKYC API', priority: 1, isConfigured: false, pricePerCall: 5.00, features: ['Real-time KRA Lookup', 'All KRAs Supported', 'CKYC Number Fetch'] },
      { providerId: 'cersai_reference', providerName: 'CERSAI Reference CKYC', priority: 2, isConfigured: false, pricePerCall: 0.00, features: ['Direct CERSAI', 'CKYC Number Required', 'Free Lookup'] },
      { providerId: 'manual_ckyc', providerName: 'Manual CKYC Submission', priority: 3, isConfigured: true, pricePerCall: 0.00, features: ['Admin Assisted', 'Form Submission', 'Offline Process'] },
    ],
  },
  {
    stepId: 'fatca_declaration',
    stepName: 'FATCA/CRS Declaration',
    description: 'Foreign Account Tax Compliance Act self-declaration for international tax reporting',
    regulatoryBasis: 'FATCA IGA India-US, CRS (Common Reporting Standard), SEBI Circular CIR/MIRSD/2/2015',
    requiredFor: ['Mutual Funds', 'PMS', 'AIF', 'Demat Account'],
    providers: [
      { providerId: 'self_declaration', providerName: 'Self-Declaration Form', priority: 1, isConfigured: true, pricePerCall: 0.00, features: ['Digital Form', 'Auto-populated', 'No API Cost'] },
    ],
  },
  {
    stepId: 'risk_profiling',
    stepName: 'Risk Profiling',
    description: 'SEBI-mandated risk assessment questionnaire for investment suitability',
    regulatoryBasis: 'SEBI Circular SEBI/HO/IMD/DF2/CIR/P/2019/155, AMFI Best Practices Guidelines',
    requiredFor: ['Mutual Funds', 'PMS', 'AIF', 'Direct Equity'],
    providers: [
      { providerId: 'internal_engine', providerName: 'FintekPro Risk Engine', priority: 1, isConfigured: true, pricePerCall: 0.00, features: ['SEBI Compliant', '20+ Questions', 'Risk Score'] },
    ],
  },
];

type OverrideMap = Record<string, Record<string, { priority?: number; pricePerCall?: number }>>;

async function loadOverrides(): Promise<OverrideMap> {
  try {
    const [row] = await db
      .select({ value: adminSettings.value })
      .from(adminSettings)
      .where(eq(adminSettings.key, SETTINGS_KEY));
    if (row?.value && typeof row.value === 'object') {
      return row.value as OverrideMap;
    }
  } catch (err) {
    console.error('[KYC Flow Routes] Failed to load overrides:', err);
  }
  return {};
}

async function saveOverrides(overrides: OverrideMap): Promise<void> {
  try {
    await db
      .insert(adminSettings)
      .values({ key: SETTINGS_KEY, value: overrides, description: 'KYC flow provider priority and pricing overrides' })
      .onConflictDoUpdate({ target: adminSettings.key, set: { value: overrides, updatedAt: new Date() } });
  } catch (err) {
    console.error('[KYC Flow Routes] Failed to save overrides (in-memory state still updated):', err);
  }
}

function applyOverrides(overrides: OverrideMap): void {
  for (const step of kycFlowConfig) {
    const stepOverrides = overrides[step.stepId];
    if (!stepOverrides) continue;
    for (const provider of step.providers) {
      const providerOverride = stepOverrides[provider.providerId];
      if (!providerOverride) continue;
      if (typeof providerOverride.priority === 'number') provider.priority = providerOverride.priority;
      if (typeof providerOverride.pricePerCall === 'number') provider.pricePerCall = providerOverride.pricePerCall;
    }
    step.providers.sort((a, b) => a.priority - b.priority);
  }
}

function refreshConfigStatus() {
  for (const step of kycFlowConfig) {
    for (const provider of step.providers) {
      switch (provider.providerId) {
        case 'sandbox':
        case 'sandbox_bank':
          provider.isConfigured = !!(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
          break;
        case 'truthscreen':
        case 'truthscreen_ckyc':
          provider.isConfigured = !!(process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD);
          break;
        case 'cashfree':
        case 'cashfree_bank':
          provider.isConfigured = !!(
            (process.env.CASHFREE_SECUREID_APP_ID || process.env.CASHFREE_VERIFICATION_APP_ID || process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID) &&
            (process.env.CASHFREE_SECUREID_SECRET_KEY || process.env.CASHFREE_VERIFICATION_SECRET_KEY || process.env.CASHFREE_PG_SECRET_KEY || process.env.CASHFREE_SECRET_KEY)
          );
          break;
        case 'aadhaar_address': {
          const hasAnyAadhaarProvider = !!(
            (process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET) ||
            (process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD) ||
            (process.env.CASHFREE_SECUREID_APP_ID || process.env.CASHFREE_VERIFICATION_APP_ID || process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID)
          );
          provider.isConfigured = hasAnyAadhaarProvider;
          break;
        }
        case 'digilocker':
          provider.isConfigured = !!(process.env.DIGILOCKER_CLIENT_ID);
          break;
        case 'cersai_reference':
          provider.isConfigured = !!(process.env.CKYC_API_KEY && process.env.CKYC_API_SECRET);
          break;
      }
    }
  }
}

router.get('/flow', async (_req: Request, res: Response) => {
  try {
    const overrides = await loadOverrides();
    applyOverrides(overrides);
    refreshConfigStatus();
    res.json({
      success: true,
      steps: kycFlowConfig,
      meta: {
        totalSteps: kycFlowConfig.length,
        totalProviders: kycFlowConfig.reduce((sum, s) => sum + s.providers.length, 0),
        configuredProviders: kycFlowConfig.reduce((sum, s) => sum + s.providers.filter(p => p.isConfigured).length, 0),
      },
    });
  } catch (error) {
    console.error('[KYC Flow Routes] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch KYC flow configuration' });
  }
});

router.patch('/flow/:stepId/priorities', async (req: Request, res: Response) => {
  try {
    const { stepId } = req.params;
    const { providers } = req.body;

    if (!Array.isArray(providers)) {
      return res.status(400).json({ success: false, error: 'providers must be an array of { providerId, priority }' });
    }

    const step = kycFlowConfig.find(s => s.stepId === stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: `Step ${stepId} not found` });
    }

    for (const { providerId, priority } of providers) {
      const provider = step.providers.find(p => p.providerId === providerId);
      if (provider && typeof priority === 'number' && priority >= 1) {
        provider.priority = priority;
      }
    }

    step.providers.sort((a, b) => a.priority - b.priority);

    const overrides = await loadOverrides();
    if (!overrides[stepId]) overrides[stepId] = {};
    for (const p of step.providers) {
      if (!overrides[stepId][p.providerId]) overrides[stepId][p.providerId] = {};
      overrides[stepId][p.providerId].priority = p.priority;
    }
    await saveOverrides(overrides);

    res.json({ success: true, step });
  } catch (error) {
    console.error('[KYC Flow Routes] Error updating priorities:', error);
    res.status(500).json({ success: false, error: 'Failed to update priorities' });
  }
});

router.patch('/flow/:stepId/provider/:providerId/price', async (req: Request, res: Response) => {
  try {
    const { stepId, providerId } = req.params;
    const { pricePerCall } = req.body;

    if (typeof pricePerCall !== 'number' || pricePerCall < 0) {
      return res.status(400).json({ success: false, error: 'Invalid price' });
    }

    const step = kycFlowConfig.find(s => s.stepId === stepId);
    if (!step) return res.status(404).json({ success: false, error: 'Step not found' });

    const provider = step.providers.find(p => p.providerId === providerId);
    if (!provider) return res.status(404).json({ success: false, error: 'Provider not found' });

    provider.pricePerCall = pricePerCall;

    const overrides = await loadOverrides();
    if (!overrides[stepId]) overrides[stepId] = {};
    if (!overrides[stepId][providerId]) overrides[stepId][providerId] = {};
    overrides[stepId][providerId].pricePerCall = pricePerCall;
    await saveOverrides(overrides);

    res.json({ success: true, provider });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update pricing' });
  }
});

/**
 * Returns the PAN verification providers sorted by admin-configured priority,
 * with isConfigured status refreshed from env vars.
 * Used by /api/kyc/verify-pan to honour the admin/kyc-flow ordering.
 */
export async function getOrderedPanProviders(): Promise<KycStepProvider[]> {
  const overrides = await loadOverrides();
  applyOverrides(overrides);
  refreshConfigStatus();
  const panStep = kycFlowConfig.find(s => s.stepId === 'pan_verification');
  if (!panStep) return [];
  return [...panStep.providers].sort((a, b) => a.priority - b.priority);
}

export default router;
