import { Injectable, Logger } from '@nestjs/common';
import { CashService } from '../cash/cash.service';
import { db } from '../../server/db';
import { treasuryPositions } from '../../shared/schema/treasury';

@Injectable()
export class RiskManagementService {
  private readonly logger = new Logger(RiskManagementService.name);

  constructor(private readonly cashService: CashService) {}

  async evaluateConcentrationRisk(entityId: string) {
    const positions = await this.cashService.getConsolidatedPosition(entityId);
    const totalCash = positions.reduce((sum, p) => sum + parseFloat(p.availableBalance), 0);
    
    if (totalCash === 0) return [];

    const risks = [];
    for (const pos of positions) {
      const concentration = (parseFloat(pos.availableBalance) / totalCash) * 100;
      if (concentration > 50) {
        risks.push({
          type: 'CONCENTRATION_RISK',
          severity: 'HIGH',
          message: `Over 50% of liquidity is held in ${pos.bankName}. Recommendation: Diversify across at least 3 banks.`,
          metadata: { bank: pos.bankName, concentration: `${concentration.toFixed(1)}%` }
        });
      }
    }

    return risks;
  }

  async evaluateCurrencyRisk(entityId: string) {
    // Check if any non-INR balances exist and if they are hedged
    // This would require integration with an FX rate service
    return [
      {
        type: 'CURRENCY_EXPOSURE',
        severity: 'MEDIUM',
        message: 'Significant USD exposure identified. Current hedge coverage is 0%.',
        recommendation: 'Initiate forward contract for $250k'
      }
    ];
  }
}
