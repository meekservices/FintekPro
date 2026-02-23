type KycEnvironment = 'sandbox' | 'production';

interface ProviderConfig {
  pan: string;
  aadhaar: string;
  ckyc: string;
  aml: string;
}

interface EnvironmentFlags {
  environment: KycEnvironment;
  fixedOtpEnabled: boolean;
  providerFallback: boolean;
  testPanBlockedInProd: boolean;
  sandboxProviders: ProviderConfig;
  prodProviders: ProviderConfig;
}

const TEST_PAN_PATTERNS = [
  /^ABCPD\d{4}[A-Z]$/,
  /^AAAPZ\d{4}[A-Z]$/,
  /^XXXXX\d{4}[A-Z]$/,
  /^ZZZZZ\d{4}[A-Z]$/,
  /^TEST/i,
];

function detectActiveProvider(service: 'pan' | 'aadhaar' | 'ckyc' | 'aml'): string {
  const hasSandbox = !!(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET);
  const hasTruthScreen = !!(process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD);
  const hasCashfree = !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

  switch (service) {
    case 'pan':
      if (hasSandbox) return 'sandbox';
      if (hasTruthScreen) return 'truthscreen';
      if (hasCashfree) return 'cashfree';
      return 'none';
    case 'aadhaar':
      if (hasSandbox) return 'sandbox';
      if (hasCashfree) return 'cashfree';
      if (hasTruthScreen) return 'truthscreen';
      return 'offline_xml';
    case 'ckyc':
      if (hasTruthScreen) return 'truthscreen';
      return 'none';
    case 'aml':
      if (hasTruthScreen) return 'truthscreen';
      return 'none';
    default:
      return 'none';
  }
}

class KycEnvironmentService {
  private flags: EnvironmentFlags;

  constructor() {
    const env: KycEnvironment = process.env.KYC_ENVIRONMENT
      ? (process.env.KYC_ENVIRONMENT as KycEnvironment)
      : (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');

    const hasTruthScreenCreds = !!(process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD);

    this.flags = {
      environment: env,
      fixedOtpEnabled: env === 'sandbox',
      providerFallback: true,
      testPanBlockedInProd: true,
      sandboxProviders: {
        pan: detectActiveProvider('pan'),
        aadhaar: detectActiveProvider('aadhaar'),
        ckyc: hasTruthScreenCreds ? 'sandbox' : 'mock',
        aml: hasTruthScreenCreds ? 'sandbox' : 'mock',
      },
      prodProviders: {
        pan: detectActiveProvider('pan'),
        aadhaar: detectActiveProvider('aadhaar'),
        ckyc: detectActiveProvider('ckyc'),
        aml: detectActiveProvider('aml'),
      },
    };

    console.log(`✅ KYC Environment Service initialized (${this.flags.environment})`);
    if (this.flags.fixedOtpEnabled) {
      console.log('   ⚠️ Fixed OTP enabled (sandbox mode)');
    }
    console.log(`   Active providers → Pan: ${this.flags.prodProviders.pan}, Aadhaar: ${this.flags.prodProviders.aadhaar}, CKYC: ${this.flags.prodProviders.ckyc}, AML: ${this.flags.prodProviders.aml}`);
    console.log(`   CKYC: ${this.flags.sandboxProviders.ckyc} | AML: ${this.flags.sandboxProviders.aml} (TruthScreen creds: ${hasTruthScreenCreds ? 'found' : 'missing'})`);
  }

  getEnvironment(): KycEnvironment {
    return this.flags.environment;
  }

  isSandbox(): boolean {
    return this.flags.environment === 'sandbox';
  }

  isProduction(): boolean {
    return this.flags.environment === 'production';
  }

  isFixedOtpEnabled(): boolean {
    return this.flags.fixedOtpEnabled;
  }

  getFixedOtp(): string | null {
    if (!this.flags.fixedOtpEnabled) return null;
    return '123456';
  }

  isTestPan(panNumber: string): boolean {
    return TEST_PAN_PATTERNS.some(pattern => pattern.test(panNumber));
  }

  validatePanForEnvironment(panNumber: string): { allowed: boolean; reason?: string } {
    if (this.isProduction() && this.flags.testPanBlockedInProd && this.isTestPan(panNumber)) {
      return { allowed: false, reason: 'Test PAN numbers are not allowed in production environment' };
    }
    return { allowed: true };
  }

  getActiveProvider(service: 'pan' | 'aadhaar' | 'ckyc' | 'aml'): string {
    const providers = this.isSandbox() ? this.flags.sandboxProviders : this.flags.prodProviders;
    return providers[service];
  }

  isProviderFallbackEnabled(): boolean {
    return this.flags.providerFallback;
  }

  getFlags(): EnvironmentFlags {
    return { ...this.flags };
  }

  getProviderStatus(): Record<string, { provider: string; displayName: string; status: string; environment: string }> {
    const providers = this.isSandbox() ? this.flags.sandboxProviders : this.flags.prodProviders;
    const getStatus = (provider: string) => {
      if (provider === 'mock' || provider === 'none') return 'mock';
      return 'active';
    };
    const displayNames: Record<string, string> = {
      sandbox: 'Sandbox.co.in',
      truthscreen: 'TruthScreen',
      cashfree: 'Cashfree',
      authbridge: 'AuthBridge',
      offline_xml: 'Offline XML',
      mock: 'Mock',
      none: 'Not Configured',
    };
    const getDisplayName = (id: string) => displayNames[id] || id;
    return {
      pan: { provider: providers.pan, displayName: getDisplayName(providers.pan), status: getStatus(providers.pan), environment: this.flags.environment },
      aadhaar: { provider: providers.aadhaar, displayName: getDisplayName(providers.aadhaar), status: getStatus(providers.aadhaar), environment: this.flags.environment },
      ckyc: { provider: providers.ckyc, displayName: getDisplayName(providers.ckyc), status: getStatus(providers.ckyc), environment: this.flags.environment },
      aml: { provider: providers.aml, displayName: getDisplayName(providers.aml), status: getStatus(providers.aml), environment: this.flags.environment },
    };
  }
}

export const kycEnvironmentService = new KycEnvironmentService();
