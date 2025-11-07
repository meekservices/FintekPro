/**
 * Pricing Utilities
 * Handles markup calculations for products and bonds
 */

interface PricingInput {
  basePrice: number | string;
  markup: number | string;
  markupType: 'percentage' | 'fixed';
}

/**
 * Calculate final price with markup applied
 * @param basePrice - The base price of the product/bond
 * @param markup - The markup amount (percentage or fixed value)
 * @param markupType - Type of markup ('percentage' or 'fixed')
 * @returns Final price after applying markup
 */
export function calculateFinalPrice(
  basePrice: number | string,
  markup: number | string = 0,
  markupType: 'percentage' | 'fixed' = 'percentage'
): number {
  const base = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
  const markupValue = typeof markup === 'string' ? parseFloat(markup) : markup;

  if (isNaN(base) || base === 0) {
    return 0;
  }

  if (isNaN(markupValue) || markupValue === 0) {
    return base;
  }

  if (markupType === 'percentage') {
    // Apply percentage markup
    return base * (1 + markupValue / 100);
  } else {
    // Apply fixed markup
    return base + markupValue;
  }
}

/**
 * Apply markup to a product object
 * Modifies the product to include finalPrice
 */
export function applyProductMarkup(product: any): any {
  if (!product) return product;

  const basePrice = product.basePrice || product.minimumInvestment || 0;
  const markup = product.markup || 0;
  const markupType = product.markupType || 'percentage';

  return {
    ...product,
    finalPrice: calculateFinalPrice(basePrice, markup, markupType),
  };
}

/**
 * Apply markup to a bond object
 * Modifies the bond to include finalPrice
 */
export function applyBondMarkup(bond: any): any {
  if (!bond) return bond;

  const currentPrice = bond.currentPrice || bond.issuePrice || bond.faceValue || 100;
  const markup = bond.markup || 0;
  const markupType = bond.markupType || 'percentage';

  return {
    ...bond,
    finalPrice: calculateFinalPrice(currentPrice, markup, markupType),
  };
}

/**
 * Bulk apply markup to an array of products
 */
export function applyBulkProductMarkup(products: any[]): any[] {
  if (!products || !Array.isArray(products)) return [];
  return products.map(applyProductMarkup);
}

/**
 * Bulk apply markup to an array of bonds
 */
export function applyBulkBondMarkup(bonds: any[]): any[] {
  if (!bonds || !Array.isArray(bonds)) return [];
  return bonds.map(applyBondMarkup);
}

/**
 * Calculate markup percentage from base and final price
 * Useful for reverse calculation
 */
export function calculateMarkupPercentage(
  basePrice: number | string,
  finalPrice: number | string
): number {
  const base = typeof basePrice === 'string' ? parseFloat(basePrice) : basePrice;
  const final = typeof finalPrice === 'string' ? parseFloat(finalPrice) : finalPrice;

  if (isNaN(base) || isNaN(final) || base === 0) {
    return 0;
  }

  return ((final - base) / base) * 100;
}

/**
 * Validate markup input
 */
export function validateMarkup(markup: number | string, markupType: string): boolean {
  const markupValue = typeof markup === 'string' ? parseFloat(markup) : markup;
  
  if (isNaN(markupValue)) {
    return false;
  }

  if (markupType === 'percentage') {
    // Percentage markup should be reasonable (0-100%)
    return markupValue >= 0 && markupValue <= 100;
  } else if (markupType === 'fixed') {
    // Fixed markup should be non-negative
    return markupValue >= 0;
  }

  return false;
}
