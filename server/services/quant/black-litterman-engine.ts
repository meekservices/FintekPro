import { db } from '../../db';
import { quantRunLog } from '@shared/schema';
import type { MVOResult } from './mvo-engine';

export interface ViewSignal {
  category: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  magnitude: number;
  confidence: number;
  source: 'POTD' | 'REGIME' | 'MOMENTUM' | 'ANALYST';
}

export interface BLConfig {
  tau: number;
  tacticalBudget: number;
  riskAversion: number;
}

export interface BLResult {
  posteriorReturns: number[];
  posteriorWeights: Record<string, number>;
  impliedReturns: number[];
  viewAdjustments: Record<string, number>;
  tacticalTilts: Record<string, number>;
  categories: string[];
  modelVersion: string;
}

const DEFAULT_BL_CONFIG: BLConfig = {
  tau: 0.05,
  tacticalBudget: 0.10,
  riskAversion: 2.5,
};

class BlackLittermanEngine {
  computeImpliedReturns(
    covarianceMatrix: number[][],
    marketWeights: number[],
    riskAversion: number
  ): number[] {
    const n = marketWeights.length;
    const pi: number[] = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        pi[i] += riskAversion * covarianceMatrix[i][j] * marketWeights[j];
      }
    }

    return pi;
  }

  buildViewMatrices(
    views: ViewSignal[],
    categories: string[]
  ): { P: number[][]; Q: number[]; Omega: number[][] } {
    const validViews = views.filter(v => {
      const idx = categories.indexOf(v.category);
      return idx >= 0 && v.direction !== 'NEUTRAL';
    });

    if (validViews.length === 0) {
      return { P: [], Q: [], Omega: [] };
    }

    const k = validViews.length;
    const n = categories.length;

    const P: number[][] = Array.from({ length: k }, () => Array(n).fill(0));
    const Q: number[] = new Array(k);
    const Omega: number[][] = Array.from({ length: k }, () => Array(k).fill(0));

    validViews.forEach((view, vi) => {
      const catIdx = categories.indexOf(view.category);
      P[vi][catIdx] = view.direction === 'BULLISH' ? 1 : -1;
      Q[vi] = view.magnitude * (view.direction === 'BULLISH' ? 1 : -1);
      const uncertainty = 1 / Math.max(view.confidence, 0.1);
      Omega[vi][vi] = uncertainty * uncertainty * 0.01;
    });

    return { P, Q, Omega };
  }

  computePosteriorReturns(
    impliedReturns: number[],
    covarianceMatrix: number[][],
    P: number[][],
    Q: number[],
    Omega: number[][],
    tau: number
  ): number[] {
    if (P.length === 0) {
      return [...impliedReturns];
    }

    const n = impliedReturns.length;
    const k = P.length;

    const tauSigma = covarianceMatrix.map(row => row.map(v => v * tau));

    const tauSigmaInv = this.invertMatrix(tauSigma);
    if (!tauSigmaInv) {
      console.warn('[BL] Failed to invert tau*Sigma, returning implied returns');
      return [...impliedReturns];
    }

    const Pt = this.transpose(P);
    const OmegaInv = this.invertMatrix(Omega);
    if (!OmegaInv) {
      console.warn('[BL] Failed to invert Omega, returning implied returns');
      return [...impliedReturns];
    }

    const PtOmegaInv = this.multiply(Pt, OmegaInv);
    const PtOmegaInvP = this.multiply(PtOmegaInv, P);

    const posteriorPrecision: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => tauSigmaInv[i][j] + PtOmegaInvP[i][j])
    );

    const posteriorCov = this.invertMatrix(posteriorPrecision);
    if (!posteriorCov) {
      console.warn('[BL] Failed to invert posterior precision, returning implied returns');
      return [...impliedReturns];
    }

    const tauSigmaInvPi: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        tauSigmaInvPi[i] += tauSigmaInv[i][j] * impliedReturns[j];
      }
    }

    const PtOmegaInvQ: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let l = 0; l < k; l++) {
        PtOmegaInvQ[i] += PtOmegaInv[i][l] * Q[l];
      }
    }

    const posteriorReturns: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const sum = tauSigmaInvPi[i] + PtOmegaInvQ[i];
      for (let j = 0; j < n; j++) {
        posteriorReturns[i] += posteriorCov[i][j] * (tauSigmaInvPi[j] + PtOmegaInvQ[j]);
      }
    }

    return posteriorReturns;
  }

  applyTacticalBudget(
    strategicWeights: number[],
    posteriorWeights: number[],
    tacticalBudget: number
  ): number[] {
    const n = strategicWeights.length;
    const tilts = posteriorWeights.map((pw, i) => pw - strategicWeights[i]);
    const totalTilt = tilts.reduce((s, t) => s + Math.abs(t), 0);

    if (totalTilt <= tacticalBudget) {
      return posteriorWeights;
    }

    const scale = tacticalBudget / totalTilt;
    const constrained = strategicWeights.map((sw, i) => sw + tilts[i] * scale);

    const sum = constrained.reduce((s, w) => s + w, 0);
    return constrained.map(w => w / sum);
  }

  async run(
    mvoResult: MVOResult,
    views: ViewSignal[],
    config: Partial<BLConfig> = {},
    portfolioId?: string
  ): Promise<BLResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_BL_CONFIG, ...config };
    const { categories, covarianceMatrix, annualizedCovarianceMatrix, weights: strategicWeightsMap } = mvoResult;
    // Use annualised covariance so that BL views (expressed in annual return terms, e.g. 0.15 = 15%)
    // are on the same scale as the implied returns. Daily cov suppresses view signals by ~250×.
    const blCovMatrix = annualizedCovarianceMatrix ?? covarianceMatrix;
    const strategicWeights = categories.map(c => strategicWeightsMap[c] || 0);

    try {
      const impliedReturns = this.computeImpliedReturns(
        blCovMatrix, strategicWeights, fullConfig.riskAversion
      );

      const { P, Q, Omega } = this.buildViewMatrices(views, categories);

      const posteriorReturns = this.computePosteriorReturns(
        impliedReturns, blCovMatrix, P, Q, Omega, fullConfig.tau
      );

      let rawPosteriorWeights = this.returnsToWeights(
        posteriorReturns, blCovMatrix, fullConfig.riskAversion
      );

      const constrainedWeights = this.applyTacticalBudget(
        strategicWeights, rawPosteriorWeights, fullConfig.tacticalBudget
      );

      const posteriorWeightsMap: Record<string, number> = {};
      const viewAdjustments: Record<string, number> = {};
      const tacticalTilts: Record<string, number> = {};

      categories.forEach((cat, i) => {
        posteriorWeightsMap[cat] = Math.round(constrainedWeights[i] * 10000) / 10000;
        viewAdjustments[cat] = Math.round((posteriorReturns[i] - impliedReturns[i]) * 10000) / 10000;
        tacticalTilts[cat] = Math.round((constrainedWeights[i] - strategicWeights[i]) * 10000) / 10000;
      });

      const runTimeMs = Date.now() - startTime;
      const modelVersion = `bl-v1.0-tau${fullConfig.tau}-tb${fullConfig.tacticalBudget}`;

      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'BLACK_LITTERMAN',
          runTimeMs,
          status: 'SUCCESS',
          outputSummary: {
            viewCount: views.length,
            tacticalTilts,
            posteriorWeights: posteriorWeightsMap,
          },
          fallbackUsed: false,
        });
      } catch (e) {
        console.warn('[BL] Failed to log run:', e);
      }

      console.log(`[BL] Tactical overlay complete in ${runTimeMs}ms. Views: ${views.length}, Active tilts: ${Object.values(tacticalTilts).filter(t => Math.abs(t) > 0.001).length}`);

      return {
        posteriorReturns,
        posteriorWeights: posteriorWeightsMap,
        impliedReturns,
        viewAdjustments,
        tacticalTilts,
        categories,
        modelVersion,
      };
    } catch (error: any) {
      const runTimeMs = Date.now() - startTime;
      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'BLACK_LITTERMAN',
          runTimeMs,
          status: 'ERROR',
          errorMessage: error.message,
          fallbackUsed: true,
        });
      } catch (reportErr: any) {
        console.warn('[BL] Failed to record error status:', reportErr?.message);
      }

      console.error('[BL] Tactical overlay failed:', error.message);
      throw error;
    }
  }

  private returnsToWeights(
    returns: number[], covMatrix: number[][], riskAversion: number
  ): number[] {
    const n = returns.length;
    const inv = this.invertMatrix(covMatrix);
    if (!inv) {
      return Array(n).fill(1 / n);
    }

    const raw: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        raw[i] += inv[i][j] * returns[j];
      }
      raw[i] /= riskAversion;
    }

    const sum = raw.reduce((s, w) => s + Math.abs(w), 0);
    if (sum === 0) return Array(n).fill(1 / n);

    const normalized = raw.map(w => Math.max(0, w));
    const normSum = normalized.reduce((s, w) => s + w, 0);
    return normSum > 0 ? normalized.map(w => w / normSum) : Array(n).fill(1 / n);
  }

  private invertMatrix(matrix: number[][]): number[][] | null {
    const n = matrix.length;
    if (n === 0) return null;

    const augmented = matrix.map((row, i) => {
      const identityRow = Array(n).fill(0);
      identityRow[i] = 1;
      return [...row, ...identityRow];
    });

    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
          maxRow = row;
        }
      }
      [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

      const pivot = augmented[col][col];
      if (Math.abs(pivot) < 1e-12) return null;

      for (let j = 0; j < 2 * n; j++) {
        augmented[col][j] /= pivot;
      }

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }

    return augmented.map(row => row.slice(n));
  }

  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j][i] = matrix[i][j];
      }
    }
    return result;
  }

  private multiply(A: number[][], B: number[][]): number[][] {
    const m = A.length;
    const n = B[0]?.length || 0;
    const p = B.length;
    const result: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < p; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  convertPotdToViews(
    potdPicks: Array<{
      instrumentName: string;
      category: string;
      recoPrice: number;
      targetPrice: number;
      confidenceScore?: number;
    }>
  ): ViewSignal[] {
    return potdPicks.map(pick => {
      const upside = (pick.targetPrice - pick.recoPrice) / pick.recoPrice;
      return {
        category: pick.category,
        direction: upside > 0 ? 'BULLISH' as const : 'BEARISH' as const,
        magnitude: Math.abs(upside),
        confidence: (pick.confidenceScore || 50) / 100,
        source: 'POTD' as const,
      };
    });
  }
}

export const blackLittermanEngine = new BlackLittermanEngine();
