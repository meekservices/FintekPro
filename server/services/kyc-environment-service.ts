type KycEnvironment = 'sandbox' | 'production';

interface EnvironmentFlags {
  environment: KycEnvironment;
  fixedOtpEnabled: boolean;
  providerFallback: boolean;
  testPanBlockedInProd: boolean;
  sandboxProviders: {
    pan: string;
    aadhaar: string;
    ckyc: string;
    aml: string;
  };
  prodProviders: {
    pan: string;
    aadhaar: string;
    ckyc: string;
    aml: string;
  };
}

const TEST_PAN_PATTERNS = [
  /^ABCPD\d{4}[A-Z]$/,
  /^AAAPZ\d{4}[A-Z]$/,
  /^XXXXX\d{4}[A-Z]$/,
  /^ZZZZZ\d{4}[A-Z]$/,
  /^TEST/i,
];

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
      providerFallback: process.env.KYC_PROVIDER_FALLBACK === 'true',
      testPanBlockedInProd: true,
      sandboxProviders: {
        pan: 'sandbox',
        aadhaar: 'sandbox',
        ckyc: hasTruthScreenCreds ? 'sandbox' : 'mock',
        aml: hasTruthScreenCreds ? 'sandbox' : 'mock',
      },
      prodProviders: {
        pan: process.env.KYC_PAN_PROVIDER || 'cashfree',
        aadhaar: process.env.KYC_AADHAAR_PROVIDER || 'authbridge',
        ckyc: process.env.KYC_CKYC_PROVIDER || 'truthscreen',
        aml: process.env.KYC_AML_PROVIDER || 'truthscreen',
      },
    };

    console.log(`✅ KYC Environment Service initialized (${this.flags.environment})`);
    if (this.flags.fixedOtpEnabled) {
      console.log('   ⚠️ Fixed OTP enabled (sandbox mode)');
    }
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

  getProviderStatus(): Record<string, { provider: string; status: string; environment: string }> {
    const providers = this.isSandbox() ? this.flags.sandboxProviders : this.flags.prodProviders;
    const getStatus = (provider: string) => {
      if (provider === 'mock') return 'mock';
      if (provider === 'sandbox') return 'sandbox';
      return 'active';
    };
    return {
      pan: { provider: providers.pan, status: getStatus(providers.pan), environment: this.flags.environment },
      aadhaar: { provider: providers.aadhaar, status: getStatus(providers.aadhaar), environment: this.flags.environment },
      ckyc: { provider: providers.ckyc, status: getStatus(providers.ckyc), environment: this.flags.environment },
      aml: { provider: providers.aml, status: getStatus(providers.aml), environment: this.flags.environment },
    };
  }
}

export const kycEnvironmentService = new KycEnvironmentService();
