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

    this.flags = {
      environment: env,
      fixedOtpEnabled: env === 'sandbox',
      providerFallback: process.env.KYC_PROVIDER_FALLBACK === 'true',
      testPanBlockedInProd: true,
      sandboxProviders: {
        pan: 'sandbox',
        aadhaar: 'sandbox',
        ckyc: 'mock',
        aml: 'mock',
      },
      prodProviders: {
        pan: process.env.KYC_PAN_PROVIDER || 'cashfree',
        aadhaar: process.env.KYC_AADHAAR_PROVIDER || 'authbridge',
        ckyc: process.env.KYC_CKYC_PROVIDER || 'authbridge',
        aml: process.env.KYC_AML_PROVIDER || 'truthscreen',
      },
    };

    console.log(`✅ KYC Environment Service initialized (${this.flags.environment})`);
    if (this.flags.fixedOtpEnabled) {
      console.log('   ⚠️ Fixed OTP enabled (sandbox mode)');
    }
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
    return {
      pan: { provider: providers.pan, status: 'active', environment: this.flags.environment },
      aadhaar: { provider: providers.aadhaar, status: 'active', environment: this.flags.environment },
      ckyc: { provider: providers.ckyc, status: providers.ckyc === 'mock' ? 'mock' : 'active', environment: this.flags.environment },
      aml: { provider: providers.aml, status: providers.aml === 'mock' ? 'mock' : 'active', environment: this.flags.environment },
    };
  }
}

export const kycEnvironmentService = new KycEnvironmentService();
