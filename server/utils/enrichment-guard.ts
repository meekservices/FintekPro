const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getCurrentISTHour(): number {
  const now = new Date();
  const istTime = new Date(now.getTime() + IST_OFFSET_MS);
  return istTime.getUTCHours();
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
}

export function isEnrichmentWindow(): boolean {
  const hour = getCurrentISTHour();
  return hour >= 20 || hour < 8;
}

export function shouldRunEnrichment(): boolean {
  return isProductionEnvironment() && isEnrichmentWindow();
}

export function getEnrichmentGuardReason(): string {
  if (!isProductionEnvironment()) {
    return `NODE_ENV=${process.env.NODE_ENV || 'undefined'} (requires production)`;
  }
  if (!isEnrichmentWindow()) {
    const hour = getCurrentISTHour();
    return `Current IST hour: ${hour} (allowed: 8 PM - 8 AM IST only)`;
  }
  return 'OK';
}

export function logEnrichmentSkip(serviceName: string): void {
  const reason = getEnrichmentGuardReason();
  console.log(`⏭️ [${serviceName}] Skipped - ${reason}`);
}
