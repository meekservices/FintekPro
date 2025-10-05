/**
 * Bond Calculator Utilities
 * 
 * Financial calculations for bonds including:
 * - Yield to Maturity (YTM)
 * - Duration (Macaulay and Modified)
 * - Accrued Interest
 * - Bond Pricing
 * - Current Yield
 */

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / msPerDay);
}

/**
 * Calculate accrued interest on a bond
 */
export function calculateAccruedInterest(params: {
  faceValue: number;
  couponRate: number;  // Annual coupon rate as percentage
  lastCouponDate: Date;
  settlementDate: Date;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, couponRate, lastCouponDate, settlementDate, frequency } = params;
  
  // Days per period
  const daysPerPeriod: Record<typeof frequency, number> = {
    'annual': 365,
    'semi_annual': 182.5,
    'quarterly': 91.25,
    'monthly': 30.42
  };
  
  const daysSinceLastCoupon = daysBetween(lastCouponDate, settlementDate);
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const couponPerPeriod = (faceValue * (couponRate / 100)) / periodsPerYear[frequency];
  const accruedInterest = couponPerPeriod * (daysSinceLastCoupon / daysPerPeriod[frequency]);
  
  return Math.round(accruedInterest * 100) / 100;
}

/**
 * Calculate Yield to Maturity (YTM) using Newton-Raphson approximation
 */
export function calculateYieldToMaturity(params: {
  faceValue: number;
  currentPrice: number;
  couponRate: number;  // Annual coupon rate as percentage
  yearsToMaturity: number;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, currentPrice, couponRate, yearsToMaturity, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const totalPeriods = yearsToMaturity * n;
  const couponPayment = (faceValue * (couponRate / 100)) / n;
  
  // Initial guess using current yield
  let ytm = ((couponPayment * n) + ((faceValue - currentPrice) / yearsToMaturity)) / currentPrice;
  
  // Newton-Raphson iteration
  for (let i = 0; i < 100; i++) {
    const ytmPerPeriod = ytm / n;
    
    // Calculate bond price at current YTM guess
    let pv = 0;
    for (let t = 1; t <= totalPeriods; t++) {
      pv += couponPayment / Math.pow(1 + ytmPerPeriod, t);
    }
    pv += faceValue / Math.pow(1 + ytmPerPeriod, totalPeriods);
    
    // Calculate derivative
    let dpv = 0;
    for (let t = 1; t <= totalPeriods; t++) {
      dpv += (-t * couponPayment) / (n * Math.pow(1 + ytmPerPeriod, t + 1));
    }
    dpv += (-totalPeriods * faceValue) / (n * Math.pow(1 + ytmPerPeriod, totalPeriods + 1));
    
    // Update YTM
    const newYtm = ytm - (pv - currentPrice) / dpv;
    
    // Check for convergence
    if (Math.abs(newYtm - ytm) < 0.000001) {
      return Math.round(newYtm * 10000) / 100; // Return as percentage with 2 decimals
    }
    
    ytm = newYtm;
  }
  
  return Math.round(ytm * 10000) / 100; // Return as percentage
}

/**
 * Calculate current yield of a bond
 */
export function calculateCurrentYield(params: {
  faceValue: number;
  currentPrice: number;
  couponRate: number;  // Annual coupon rate as percentage
}): number {
  const { faceValue, currentPrice, couponRate } = params;
  const annualCoupon = faceValue * (couponRate / 100);
  const currentYield = (annualCoupon / currentPrice) * 100;
  
  return Math.round(currentYield * 100) / 100;
}

/**
 * Calculate Macaulay Duration
 */
export function calculateMacaulayDuration(params: {
  faceValue: number;
  couponRate: number;  // Annual coupon rate as percentage
  yieldToMaturity: number;  // Annual YTM as percentage
  yearsToMaturity: number;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const totalPeriods = yearsToMaturity * n;
  const couponPayment = (faceValue * (couponRate / 100)) / n;
  const ytmPerPeriod = (yieldToMaturity / 100) / n;
  
  // Calculate present value of cash flows
  let pvCashFlows = 0;
  let weightedPvCashFlows = 0;
  
  for (let t = 1; t <= totalPeriods; t++) {
    const pv = couponPayment / Math.pow(1 + ytmPerPeriod, t);
    pvCashFlows += pv;
    weightedPvCashFlows += (t / n) * pv; // Convert period to years
  }
  
  // Add face value at maturity
  const pvFace = faceValue / Math.pow(1 + ytmPerPeriod, totalPeriods);
  pvCashFlows += pvFace;
  weightedPvCashFlows += (totalPeriods / n) * pvFace;
  
  const macaulayDuration = weightedPvCashFlows / pvCashFlows;
  
  return Math.round(macaulayDuration * 1000) / 1000; // 3 decimal places
}

/**
 * Calculate Modified Duration
 */
export function calculateModifiedDuration(params: {
  macaulayDuration: number;
  yieldToMaturity: number;  // Annual YTM as percentage
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { macaulayDuration, yieldToMaturity, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const modifiedDuration = macaulayDuration / (1 + (yieldToMaturity / 100) / n);
  
  return Math.round(modifiedDuration * 1000) / 1000;
}

/**
 * Calculate bond price given yield
 */
export function calculateBondPrice(params: {
  faceValue: number;
  couponRate: number;  // Annual coupon rate as percentage
  yieldToMaturity: number;  // Annual YTM as percentage
  yearsToMaturity: number;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const totalPeriods = yearsToMaturity * n;
  const couponPayment = (faceValue * (couponRate / 100)) / n;
  const ytmPerPeriod = (yieldToMaturity / 100) / n;
  
  // Calculate present value of coupon payments
  let price = 0;
  for (let t = 1; t <= totalPeriods; t++) {
    price += couponPayment / Math.pow(1 + ytmPerPeriod, t);
  }
  
  // Add present value of face value
  price += faceValue / Math.pow(1 + ytmPerPeriod, totalPeriods);
  
  return Math.round(price * 100) / 100;
}

/**
 * Calculate convexity of a bond
 */
export function calculateConvexity(params: {
  faceValue: number;
  couponRate: number;  // Annual coupon rate as percentage
  yieldToMaturity: number;  // Annual YTM as percentage
  yearsToMaturity: number;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const totalPeriods = yearsToMaturity * n;
  const couponPayment = (faceValue * (couponRate / 100)) / n;
  const ytmPerPeriod = (yieldToMaturity / 100) / n;
  
  // Calculate bond price
  const bondPrice = calculateBondPrice({ faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency });
  
  // Calculate convexity
  let convexitySum = 0;
  for (let t = 1; t <= totalPeriods; t++) {
    const pv = couponPayment / Math.pow(1 + ytmPerPeriod, t);
    convexitySum += pv * t * (t + 1);
  }
  
  // Add face value contribution
  const pvFace = faceValue / Math.pow(1 + ytmPerPeriod, totalPeriods);
  convexitySum += pvFace * totalPeriods * (totalPeriods + 1);
  
  const convexity = convexitySum / (bondPrice * Math.pow(1 + ytmPerPeriod, 2) * n * n);
  
  return Math.round(convexity * 1000) / 1000;
}

/**
 * Calculate next coupon payment date
 */
export function calculateNextCouponDate(params: {
  lastCouponDate: Date;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  currentDate?: Date;
}): Date {
  const { lastCouponDate, frequency, currentDate = new Date() } = params;
  
  const monthsToAdd: Record<typeof frequency, number> = {
    'annual': 12,
    'semi_annual': 6,
    'quarterly': 3,
    'monthly': 1
  };
  
  let nextDate = new Date(lastCouponDate);
  
  while (nextDate <= currentDate) {
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd[frequency]);
  }
  
  return nextDate;
}

/**
 * Calculate total return from coupon payments over holding period
 */
export function calculateTotalCouponIncome(params: {
  faceValue: number;
  couponRate: number;  // Annual coupon rate as percentage
  purchaseDate: Date;
  currentDate: Date;
  frequency: 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
}): number {
  const { faceValue, couponRate, purchaseDate, currentDate, frequency } = params;
  
  const periodsPerYear: Record<typeof frequency, number> = {
    'annual': 1,
    'semi_annual': 2,
    'quarterly': 4,
    'monthly': 12
  };
  
  const n = periodsPerYear[frequency];
  const couponPerPeriod = (faceValue * (couponRate / 100)) / n;
  
  // Calculate number of coupon payments received
  const monthsDiff = (currentDate.getFullYear() - purchaseDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - purchaseDate.getMonth());
  
  const monthsPerPeriod = 12 / n;
  const periodsElapsed = Math.floor(monthsDiff / monthsPerPeriod);
  
  const totalCouponIncome = couponPerPeriod * periodsElapsed;
  
  return Math.round(totalCouponIncome * 100) / 100;
}
