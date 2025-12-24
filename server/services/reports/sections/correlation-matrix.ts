import type { PortfolioData } from '../report-orchestrator';

export interface CorrelationMatrixData {
  symbols: string[];
  matrix: number[][];
  insights: {
    highCorrelation: { symbol1: string; symbol2: string; correlation: number }[];
    lowCorrelation: { symbol1: string; symbol2: string; correlation: number }[];
    diversificationScore: number;
  };
}

export function computeCorrelationMatrix(portfolioData: PortfolioData): CorrelationMatrixData {
  const { holdings } = portfolioData;
  
  const symbols = holdings.map(h => h.symbol).slice(0, 15);
  
  if (symbols.length < 2) {
    return getDefaultCorrelation(symbols);
  }

  const n = symbols.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j > i) {
        const correlation = generateMockCorrelation(symbols[i], symbols[j]);
        matrix[i][j] = correlation;
        matrix[j][i] = correlation;
      }
    }
  }

  const correlationPairs: { symbol1: string; symbol2: string; correlation: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      correlationPairs.push({
        symbol1: symbols[i],
        symbol2: symbols[j],
        correlation: matrix[i][j],
      });
    }
  }

  const sorted = [...correlationPairs].sort((a, b) => b.correlation - a.correlation);
  const highCorrelation = sorted.filter(p => p.correlation > 0.7).slice(0, 5);
  const lowCorrelation = sorted.filter(p => p.correlation < 0.3).slice(0, 5);

  const avgCorrelation = correlationPairs.reduce((sum, p) => sum + Math.abs(p.correlation), 0) / correlationPairs.length;
  const diversificationScore = Math.round((1 - avgCorrelation) * 100);

  return {
    symbols,
    matrix,
    insights: {
      highCorrelation,
      lowCorrelation,
      diversificationScore,
    },
  };
}

function generateMockCorrelation(symbol1: string, symbol2: string): number {
  const hash = (symbol1 + symbol2).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const base = (hash % 100) / 100;
  return Number((base * 1.6 - 0.3).toFixed(2));
}

function getDefaultCorrelation(symbols: string[]): CorrelationMatrixData {
  return {
    symbols,
    matrix: symbols.length === 1 ? [[1]] : [],
    insights: {
      highCorrelation: [],
      lowCorrelation: [],
      diversificationScore: 0,
    },
  };
}

export default computeCorrelationMatrix;
