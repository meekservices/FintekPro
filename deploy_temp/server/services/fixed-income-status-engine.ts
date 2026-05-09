import { db } from '../db';
import { corporateBonds, fixedIncomeStatusLog } from '@shared/schema';
import { eq, sql, and, isNotNull, lte, gte } from 'drizzle-orm';

export type InstrumentStatus = 'SELLABLE' | 'VISIBLE' | 'HIDDEN';

interface GateResult {
  gate: string;
  passed: boolean;
  reason: string;
  details?: Record<string, any>;
}

interface StatusEvaluation {
  isin: string;
  previousStatus: InstrumentStatus | null;
  newStatus: InstrumentStatus;
  reason: string;
  gateResults: GateResult[];
  changed: boolean;
}

const RATING_THRESHOLD = ['AAA', 'AA+', 'AA', 'AA-', 'A+'];
const LIQUIDITY_THRESHOLD = 60;
const BID_ASK_THRESHOLD = 1.25;
const MAX_TRADING_DAYS_GAP = 3;

export class FixedIncomeStatusEngine {
  
  private isRatingAboveThreshold(rating: string | null): boolean {
    if (!rating) return false;
    return RATING_THRESHOLD.includes(rating.toUpperCase());
  }
  
  private calculateTradingDaysGap(lastTradeDate: Date | null): number {
    if (!lastTradeDate) return 999;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(lastTradeDate).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays * 5 / 7);
  }
  
  private calculateStructureComplexity(bond: any): number {
    let complexity = 1;
    if (bond.isCallable) complexity += 1;
    if (bond.isPuttable) complexity += 1;
    if (bond.securityType === 'subordinated') complexity += 1;
    if (bond.couponType === 'floating') complexity += 1;
    return Math.min(complexity, 5);
  }
  
  async evaluateInstrumentStatus(isin: string): Promise<StatusEvaluation | null> {
    const bonds = await db.select().from(corporateBonds).where(eq(corporateBonds.isin, isin)).limit(1);
    
    if (bonds.length === 0) {
      return null;
    }
    
    const bond = bonds[0];
    const gateResults: GateResult[] = [];
    let finalStatus: InstrumentStatus = 'SELLABLE';
    let statusReason = '';
    
    const gate1: GateResult = {
      gate: 'data_completeness',
      passed: true,
      reason: 'All required data present',
      details: {}
    };
    
    if (!bond.currentPrice || !bond.creditRating || !bond.maturityDate) {
      gate1.passed = false;
      gate1.reason = 'Missing required data: ' + 
        (!bond.currentPrice ? 'price ' : '') +
        (!bond.creditRating ? 'rating ' : '') +
        (!bond.maturityDate ? 'maturity' : '');
      finalStatus = 'HIDDEN';
      statusReason = gate1.reason;
    }
    gateResults.push(gate1);
    
    if (finalStatus === 'HIDDEN') {
      return this.buildEvaluation(bond, finalStatus, statusReason, gateResults);
    }
    
    const regulatoryEligibility = bond.regulatoryEligibility || 'retail';
    const gate2: GateResult = {
      gate: 'regulatory_eligibility',
      passed: regulatoryEligibility === 'retail',
      reason: regulatoryEligibility === 'retail' ? 'Retail allowed' : `Institutional only (${regulatoryEligibility})`,
      details: { eligibility: regulatoryEligibility }
    };
    gateResults.push(gate2);
    
    if (!gate2.passed) {
      finalStatus = 'VISIBLE';
      statusReason = gate2.reason;
    }
    
    if (finalStatus === 'VISIBLE') {
      return this.buildEvaluation(bond, finalStatus, statusReason, gateResults);
    }
    
    const liquidityScore = bond.liquidityScore || 0;
    const bidAskSpread = parseFloat(bond.bidAskSpread?.toString() || '999');
    const tradingDaysGap = this.calculateTradingDaysGap(bond.lastTradedDate);
    
    const gate3: GateResult = {
      gate: 'liquidity',
      passed: liquidityScore >= LIQUIDITY_THRESHOLD && 
              bidAskSpread <= BID_ASK_THRESHOLD && 
              tradingDaysGap <= MAX_TRADING_DAYS_GAP,
      reason: '',
      details: { liquidityScore, bidAskSpread, tradingDaysGap }
    };
    
    if (!gate3.passed) {
      const reasons = [];
      if (liquidityScore < LIQUIDITY_THRESHOLD) reasons.push(`Liquidity score ${liquidityScore} < ${LIQUIDITY_THRESHOLD}`);
      if (bidAskSpread > BID_ASK_THRESHOLD) reasons.push(`Bid-ask spread ${bidAskSpread}% > ${BID_ASK_THRESHOLD}%`);
      if (tradingDaysGap > MAX_TRADING_DAYS_GAP) reasons.push(`Last trade ${tradingDaysGap} days ago > ${MAX_TRADING_DAYS_GAP} days`);
      gate3.reason = reasons.join('; ');
      finalStatus = 'VISIBLE';
      statusReason = gate3.reason;
    } else {
      gate3.reason = 'Liquidity requirements met';
    }
    gateResults.push(gate3);
    
    if (finalStatus === 'VISIBLE') {
      return this.buildEvaluation(bond, finalStatus, statusReason, gateResults);
    }
    
    const gate4: GateResult = {
      gate: 'credit_quality',
      passed: this.isRatingAboveThreshold(bond.creditRating),
      reason: '',
      details: { rating: bond.creditRating }
    };
    
    if (!gate4.passed) {
      gate4.reason = `Credit rating ${bond.creditRating} below A+ threshold`;
      finalStatus = 'VISIBLE';
      statusReason = gate4.reason;
    } else {
      gate4.reason = `Credit rating ${bond.creditRating} meets threshold`;
    }
    gateResults.push(gate4);
    
    if (finalStatus === 'VISIBLE') {
      return this.buildEvaluation(bond, finalStatus, statusReason, gateResults);
    }
    
    const complexity = this.calculateStructureComplexity(bond);
    const COMPLEXITY_THRESHOLD = 3;
    
    const gate5: GateResult = {
      gate: 'structural_simplicity',
      passed: complexity <= COMPLEXITY_THRESHOLD,
      reason: '',
      details: { 
        complexity,
        isCallable: bond.isCallable,
        isPuttable: bond.isPuttable,
        securityType: bond.securityType,
        couponType: bond.couponType
      }
    };
    
    if (!gate5.passed) {
      gate5.reason = `Structure complexity ${complexity} exceeds threshold ${COMPLEXITY_THRESHOLD}`;
      finalStatus = 'VISIBLE';
      statusReason = gate5.reason;
    } else {
      gate5.reason = 'Structure is sufficiently simple for retail';
    }
    gateResults.push(gate5);
    
    if (finalStatus === 'SELLABLE') {
      statusReason = 'All 5 gates passed - instrument approved for sale';
    }
    
    return this.buildEvaluation(bond, finalStatus, statusReason, gateResults);
  }
  
  private buildEvaluation(
    bond: any, 
    newStatus: InstrumentStatus, 
    reason: string, 
    gateResults: GateResult[]
  ): StatusEvaluation {
    return {
      isin: bond.isin,
      previousStatus: bond.instrumentStatus as InstrumentStatus | null,
      newStatus,
      reason,
      gateResults,
      changed: bond.instrumentStatus !== newStatus
    };
  }
  
  async updateInstrumentStatus(
    isin: string, 
    evaluation: StatusEvaluation,
    triggeredBy: string = 'daily_refresh'
  ): Promise<void> {
    await db.update(corporateBonds)
      .set({
        instrumentStatus: evaluation.newStatus,
        statusReason: evaluation.reason,
        statusLastUpdated: new Date(),
        structureComplexity: evaluation.gateResults
          .find(g => g.gate === 'structural_simplicity')?.details?.complexity || null
      })
      .where(eq(corporateBonds.isin, isin));
    
    if (evaluation.changed) {
      await db.insert(fixedIncomeStatusLog).values({
        isin,
        previousStatus: evaluation.previousStatus,
        newStatus: evaluation.newStatus,
        changeReason: evaluation.reason,
        evaluationGates: evaluation.gateResults,
        triggeredBy
      });
    }
  }
  
  async refreshAllInstruments(): Promise<{ 
    processed: number; 
    changed: number; 
    sellable: number; 
    visible: number; 
    hidden: number;
    errors: string[];
  }> {
    const allBonds = await db.select({ isin: corporateBonds.isin })
      .from(corporateBonds)
      .where(
        and(
          isNotNull(corporateBonds.isin),
          eq(corporateBonds.tradingStatus, 'active')
        )
      );
    
    let processed = 0;
    let changed = 0;
    let sellable = 0;
    let visible = 0;
    let hidden = 0;
    const errors: string[] = [];
    
    for (const bond of allBonds) {
      try {
        const evaluation = await this.evaluateInstrumentStatus(bond.isin);
        if (evaluation) {
          await this.updateInstrumentStatus(bond.isin, evaluation, 'daily_refresh');
          processed++;
          if (evaluation.changed) changed++;
          if (evaluation.newStatus === 'SELLABLE') sellable++;
          else if (evaluation.newStatus === 'VISIBLE') visible++;
          else hidden++;
        }
      } catch (error) {
        errors.push(`Error processing ${bond.isin}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log(`[FixedIncomeStatusEngine] Daily refresh complete: ${processed} processed, ${changed} changed`);
    console.log(`[FixedIncomeStatusEngine] Status distribution: ${sellable} SELLABLE, ${visible} VISIBLE, ${hidden} HIDDEN`);
    
    return { processed, changed, sellable, visible, hidden, errors };
  }
  
  async getSellableInstruments(limit: number = 100, offset: number = 0) {
    return db.select()
      .from(corporateBonds)
      .where(eq(corporateBonds.instrumentStatus, 'SELLABLE'))
      .limit(limit)
      .offset(offset);
  }
  
  async getVisibleInstruments(limit: number = 100, offset: number = 0) {
    return db.select()
      .from(corporateBonds)
      .where(
        sql`${corporateBonds.instrumentStatus} IN ('SELLABLE', 'VISIBLE')`
      )
      .limit(limit)
      .offset(offset);
  }
  
  async getStatusTransitionHistory(isin: string, limit: number = 10) {
    return db.select()
      .from(fixedIncomeStatusLog)
      .where(eq(fixedIncomeStatusLog.isin, isin))
      .orderBy(sql`${fixedIncomeStatusLog.createdAt} DESC`)
      .limit(limit);
  }
  
  async getStatusSummary() {
    const result = await db.execute(sql`
      SELECT 
        instrument_status,
        COUNT(*) as count
      FROM corporate_bonds
      WHERE trading_status = 'active'
      GROUP BY instrument_status
    `);
    
    const summary = {
      SELLABLE: 0,
      VISIBLE: 0,
      HIDDEN: 0,
      total: 0
    };
    
    for (const row of result.rows) {
      const status = row.instrument_status as string;
      const count = parseInt(row.count as string);
      if (status === 'SELLABLE') summary.SELLABLE = count;
      else if (status === 'VISIBLE') summary.VISIBLE = count;
      else summary.HIDDEN = count;
      summary.total += count;
    }
    
    return summary;
  }
}

export const fixedIncomeStatusEngine = new FixedIncomeStatusEngine();
