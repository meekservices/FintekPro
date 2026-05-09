import type { PortfolioData } from '../report-orchestrator';

export interface RollingReturnsData {
  period: {
    months: number;
    windowSize: number;
  };
  rollingReturns: {
    date: string;
    return: number;
    annualized: number;
  }[];
  statistics: {
    averageRolling: number;
    maxRolling: number;
    minRolling: number;
    medianRolling: number;
    positivePercentage: number;
  };
}

export function computeRollingReturns(
  portfolioData: PortfolioData,
  config: { months: number; windowSize?: number }
): RollingReturnsData {
  const { snapshots } = portfolioData;
  const windowSize = config.windowSize || 12;

  const sortedSnapshots = [...snapshots]
    .sort((a, b) => new Date(a.snapshotDate!).getTime() - new Date(b.snapshotDate!).getTime())
    .slice(-config.months);

  if (sortedSnapshots.length < windowSize + 1) {
    return getDefaultRollingReturns(config.months, windowSize);
  }

  const rollingReturns: { date: string; return: number; annualized: number }[] = [];

  for (let i = windowSize; i < sortedSnapshots.length; i++) {
    const startSnapshot = sortedSnapshots[i - windowSize];
    const endSnapshot = sortedSnapshots[i];
    
    const startValue = Number(startSnapshot.totalValue) || 1;
    const endValue = Number(endSnapshot.totalValue) || 1;
    
    const periodReturn = ((endValue - startValue) / startValue) * 100;
    const annualized = (Math.pow(1 + periodReturn / 100, 12 / windowSize) - 1) * 100;

    rollingReturns.push({
      date: endSnapshot.snapshotDate!.toString().split('T')[0],
      return: periodReturn,
      annualized,
    });
  }

  const returns = rollingReturns.map(r => r.return);
  const sortedReturns = [...returns].sort((a, b) => a - b);
  
  const averageRolling = returns.reduce((a, b) => a + b, 0) / returns.length;
  const maxRolling = Math.max(...returns);
  const minRolling = Math.min(...returns);
  const medianRolling = sortedReturns[Math.floor(sortedReturns.length / 2)];
  const positivePercentage = (returns.filter(r => r > 0).length / returns.length) * 100;

  return {
    period: {
      months: config.months,
      windowSize,
    },
    rollingReturns,
    statistics: {
      averageRolling,
      maxRolling,
      minRolling,
      medianRolling,
      positivePercentage,
    },
  };
}

function getDefaultRollingReturns(months: number, windowSize: number): RollingReturnsData {
  return {
    period: { months, windowSize },
    rollingReturns: [],
    statistics: {
      averageRolling: 0,
      maxRolling: 0,
      minRolling: 0,
      medianRolling: 0,
      positivePercentage: 0,
    },
  };
}

export default computeRollingReturns;
