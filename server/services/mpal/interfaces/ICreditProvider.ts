export type CreditType = "PERSONAL_LOAN" | "HOME_LOAN" | "LAP" | "CREDIT_CARD";

export interface CreditProduct {
  id: string;
  provider: string; // bank/NBFC
  type: CreditType;
  interestRate: number;
  tenureMonths: number;
  eligibility: any;
}

export interface CreditApplication {
  userId: string;
  productId: string;
  amount?: number;
  tenure?: number;
  status: "INITIATED" | "SUBMITTED" | "APPROVED" | "REJECTED";
}

export interface ICreditProvider {
  /**
   * Identifies the credit provider implementation
   */
  readonly providerId: string;

  /**
   * Fetch available credit products from this provider
   */
  fetchProducts(): Promise<CreditProduct[]>;

  /**
   * Check user eligibility based on provided parameters
   */
  checkEligibility(user: any): Promise<any>;

  /**
   * Dispatch a structured credit application
   */
  createApplication(app: CreditApplication): Promise<any>;

  /**
   * Fetch the current status of an application
   */
  getApplicationStatus(appId: string): Promise<any>;
}
