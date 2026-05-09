import { fixedIncomeStatusEngine } from '../services/fixed-income-status-engine';

let isRunning = false;

export async function runDailyFixedIncomeRefresh(): Promise<{
  success: boolean;
  message: string;
  stats?: {
    processed: number;
    changed: number;
    sellable: number;
    visible: number;
    hidden: number;
    duration: number;
  };
  errors?: string[];
}> {
  if (isRunning) {
    console.log('[FixedIncomeRefresh] Skipping - already running');
    return { success: false, message: 'Refresh already in progress' };
  }

  isRunning = true;
  const startTime = Date.now();

  console.log(`[FixedIncomeRefresh] Starting daily refresh at ${new Date().toISOString()}`);

  try {
    const result = await fixedIncomeStatusEngine.refreshAllInstruments();
    const duration = Date.now() - startTime;

    console.log(`[FixedIncomeRefresh] Completed in ${duration}ms`);
    console.log(`[FixedIncomeRefresh] Results: ${JSON.stringify(result)}`);

    return {
      success: true,
      message: `Processed ${result.processed} instruments, ${result.changed} status changes`,
      stats: {
        processed: result.processed,
        changed: result.changed,
        sellable: result.sellable,
        visible: result.visible,
        hidden: result.hidden,
        duration
      },
      errors: result.errors.length > 0 ? result.errors : undefined
    };
  } catch (error) {
    console.error('[FixedIncomeRefresh] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      errors: [error instanceof Error ? error.stack || error.message : 'Unknown error']
    };
  } finally {
    isRunning = false;
  }
}

export function scheduleFixedIncomeRefresh(cronHour: number = 6, cronMinute: number = 0): void {
  const scheduleNextRun = () => {
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(cronHour, cronMinute, 0, 0);

    if (now >= targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const msUntilRun = targetTime.getTime() - now.getTime();

    console.log(`[FixedIncomeRefresh] Next refresh scheduled for ${targetTime.toISOString()}`);

    setTimeout(async () => {
      await runDailyFixedIncomeRefresh();
      scheduleNextRun();
    }, msUntilRun);
  };

  scheduleNextRun();
  console.log(`[FixedIncomeRefresh] Daily refresh scheduler initialized for ${cronHour}:${cronMinute.toString().padStart(2, '0')} IST`);
}

export function isMarketTradingDay(): boolean {
  const now = new Date();
  const day = now.getDay();
  return day !== 0 && day !== 6;
}
