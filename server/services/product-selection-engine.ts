import { RebalanceAction } from "./allocation-policy-service";

export interface ProductUniverse {
  equity: ProductOption[];
  debt: ProductOption[];
  gold: ProductOption[];
  cash: ProductOption[];
  alternates: ProductOption[];
  international: ProductOption[];
}

export interface ProductOption {
  id: string;
  name: string;
  isin?: string;
  category: string;
  subCategory: string;
  amc?: string;
  expenseRatio?: number;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  riskRating: 'low' | 'moderate' | 'high' | 'very_high';
  minInvestment?: number;
  exitLoadPeriodDays?: number;
  exitLoadPercent?: number;
  rating?: number;
  isRecommended?: boolean;
}

export interface ProductSelection {
  assetClass: string;
  action: 'BUY' | 'SELL';
  amount: number;
  selectedProducts: Array<{
    product: ProductOption;
    allocatedAmount: number;
    allocatedPercent: number;
    rationale: string;
  }>;
}

export interface ProductSelectionOutput {
  selections: ProductSelection[];
  totalInvestedAmount: number;
  diversificationScore: number;
  averageExpenseRatio: number;
  riskMatchScore: number;
}

export interface RiskProfile {
  tolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short' | 'medium' | 'long' | 'very_long';
  preferredCategories?: string[];
}

export class ProductSelectionEngine {
  private static instance: ProductSelectionEngine;

  private constructor() {}

  static getInstance(): ProductSelectionEngine {
    if (!this.instance) {
      this.instance = new ProductSelectionEngine();
    }
    return this.instance;
  }

  selectProducts(
    buyActions: Array<{ assetClass: string; amount: number; reason: string }>,
    productUniverse: ProductUniverse,
    riskProfile: RiskProfile
  ): ProductSelectionOutput {
    const selections: ProductSelection[] = [];
    let totalInvestedAmount = 0;
    let totalExpenseRatio = 0;
    let productCount = 0;
    let riskMatchTotal = 0;

    for (const action of buyActions) {
      const availableProducts = this.getProductsForAssetClass(action.assetClass, productUniverse);
      const filteredProducts = this.filterByRiskProfile(availableProducts, riskProfile);
      const rankedProducts = this.rankProducts(filteredProducts, riskProfile);
      
      const selection = this.allocateToProducts(
        action.assetClass,
        action.amount,
        rankedProducts,
        riskProfile
      );

      selections.push(selection);
      totalInvestedAmount += action.amount;
      
      for (const sp of selection.selectedProducts) {
        totalExpenseRatio += (sp.product.expenseRatio || 0) * sp.allocatedPercent;
        productCount++;
        riskMatchTotal += this.calculateRiskMatch(sp.product, riskProfile);
      }
    }

    const diversificationScore = this.calculateDiversification(selections);
    const averageExpenseRatio = productCount > 0 ? totalExpenseRatio / productCount : 0;
    const riskMatchScore = productCount > 0 ? (riskMatchTotal / productCount) * 100 : 0;

    return {
      selections,
      totalInvestedAmount,
      diversificationScore,
      averageExpenseRatio,
      riskMatchScore
    };
  }

  private getProductsForAssetClass(assetClass: string, universe: ProductUniverse): ProductOption[] {
    switch (assetClass.toLowerCase()) {
      case 'equity': return universe.equity || [];
      case 'debt': return universe.debt || [];
      case 'gold': return universe.gold || [];
      case 'cash': return universe.cash || [];
      case 'alternates': return universe.alternates || [];
      case 'international': return universe.international || [];
      default: return [];
    }
  }

  private filterByRiskProfile(products: ProductOption[], riskProfile: RiskProfile): ProductOption[] {
    const riskMapping: Record<string, string[]> = {
      'conservative': ['low', 'moderate'],
      'moderate': ['low', 'moderate', 'high'],
      'aggressive': ['moderate', 'high', 'very_high'],
      'very_aggressive': ['high', 'very_high']
    };

    const allowedRisks = riskMapping[riskProfile.tolerance] || ['low', 'moderate', 'high'];
    return products.filter(p => allowedRisks.includes(p.riskRating));
  }

  private rankProducts(products: ProductOption[], riskProfile: RiskProfile): ProductOption[] {
    return [...products].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.isRecommended) scoreA += 50;
      if (b.isRecommended) scoreB += 50;

      if (a.rating) scoreA += a.rating * 10;
      if (b.rating) scoreB += b.rating * 10;

      const horizonWeights: Record<string, string> = {
        'short': 'returns1Y',
        'medium': 'returns3Y',
        'long': 'returns5Y',
        'very_long': 'returns5Y'
      };
      const returnKey = horizonWeights[riskProfile.investmentHorizon] || 'returns3Y';
      
      scoreA += (a[returnKey as keyof ProductOption] as number || 0) * 2;
      scoreB += (b[returnKey as keyof ProductOption] as number || 0) * 2;

      scoreA -= (a.expenseRatio || 0) * 100;
      scoreB -= (b.expenseRatio || 0) * 100;

      return scoreB - scoreA;
    });
  }

  private allocateToProducts(
    assetClass: string,
    totalAmount: number,
    products: ProductOption[],
    riskProfile: RiskProfile
  ): ProductSelection {
    const maxProductsPerAssetClass = 3;
    const selectedProducts: ProductSelection['selectedProducts'] = [];
    
    if (products.length === 0) {
      return {
        assetClass,
        action: 'BUY',
        amount: totalAmount,
        selectedProducts: []
      };
    }

    const topProducts = products.slice(0, maxProductsPerAssetClass);
    
    const allocations = this.calculateOptimalAllocation(topProducts, riskProfile);
    
    for (let i = 0; i < topProducts.length; i++) {
      const product = topProducts[i];
      const allocationPercent = allocations[i];
      const allocatedAmount = totalAmount * (allocationPercent / 100);
      
      if (allocatedAmount >= (product.minInvestment || 500)) {
        selectedProducts.push({
          product,
          allocatedAmount,
          allocatedPercent: allocationPercent,
          rationale: this.generateRationale(product, riskProfile)
        });
      }
    }

    return {
      assetClass,
      action: 'BUY',
      amount: totalAmount,
      selectedProducts
    };
  }

  private calculateOptimalAllocation(products: ProductOption[], riskProfile: RiskProfile): number[] {
    const count = products.length;
    if (count === 0) return [];
    if (count === 1) return [100];
    if (count === 2) return [60, 40];
    return [50, 30, 20];
  }

  private generateRationale(product: ProductOption, riskProfile: RiskProfile): string {
    const parts: string[] = [];
    
    if (product.isRecommended) {
      parts.push('Recommended by our research team');
    }
    
    if (product.returns3Y) {
      parts.push(`3Y returns: ${product.returns3Y.toFixed(1)}%`);
    }
    
    if (product.expenseRatio && product.expenseRatio < 1) {
      parts.push(`Low expense ratio: ${product.expenseRatio.toFixed(2)}%`);
    }
    
    if (product.rating && product.rating >= 4) {
      parts.push(`Rated ${product.rating}/5 stars`);
    }

    return parts.length > 0 ? parts.join('. ') + '.' : 'Suitable for your risk profile.';
  }

  private calculateRiskMatch(product: ProductOption, riskProfile: RiskProfile): number {
    const riskLevels = { 'low': 1, 'moderate': 2, 'high': 3, 'very_high': 4 };
    const toleranceLevels = { 'conservative': 1, 'moderate': 2, 'aggressive': 3, 'very_aggressive': 4 };
    
    const productRisk = riskLevels[product.riskRating] || 2;
    const userTolerance = toleranceLevels[riskProfile.tolerance] || 2;
    
    const diff = Math.abs(productRisk - userTolerance);
    return Math.max(0, 1 - (diff * 0.25));
  }

  private calculateDiversification(selections: ProductSelection[]): number {
    const totalProducts = selections.reduce((sum, s) => sum + s.selectedProducts.length, 0);
    const assetClasses = selections.length;
    
    if (totalProducts === 0) return 0;
    
    const productScore = Math.min(100, totalProducts * 15);
    const assetClassScore = Math.min(100, assetClasses * 20);
    
    return Math.round((productScore + assetClassScore) / 2);
  }

  applyOverride(
    selection: ProductSelection,
    overrides: Array<{
      productId: string;
      newAmount?: number;
      remove?: boolean;
      replacementProductId?: string;
    }>,
    productUniverse: ProductUniverse
  ): ProductSelection {
    const updatedProducts = [...selection.selectedProducts];

    for (const override of overrides) {
      const idx = updatedProducts.findIndex(p => p.product.id === override.productId);
      
      if (override.remove && idx >= 0) {
        updatedProducts.splice(idx, 1);
      } else if (override.newAmount !== undefined && idx >= 0) {
        updatedProducts[idx] = {
          ...updatedProducts[idx],
          allocatedAmount: override.newAmount,
          rationale: updatedProducts[idx].rationale + ' (Advisor adjusted)'
        };
      } else if (override.replacementProductId) {
        const allProducts = this.getProductsForAssetClass(selection.assetClass, productUniverse);
        const replacement = allProducts.find(p => p.id === override.replacementProductId);
        
        if (replacement && idx >= 0) {
          updatedProducts[idx] = {
            ...updatedProducts[idx],
            product: replacement,
            rationale: 'Advisor selected replacement product'
          };
        }
      }
    }

    const totalAllocated = updatedProducts.reduce((sum, p) => sum + p.allocatedAmount, 0);
    for (const p of updatedProducts) {
      p.allocatedPercent = totalAllocated > 0 ? (p.allocatedAmount / totalAllocated) * 100 : 0;
    }

    return {
      ...selection,
      selectedProducts: updatedProducts
    };
  }
}

export const productSelectionEngine = ProductSelectionEngine.getInstance();
