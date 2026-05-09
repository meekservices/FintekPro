import { IStorage } from "./storage";

export interface AccountSelection {
  bankAccountId: string | null;
  dematAccountId: string | null;
  bankAccount?: any;
  dematAccount?: any;
}

export interface ProductRequirements {
  requiresBank: boolean;
  requiresDemat: boolean;
  depositoryType?: 'NSDL' | 'CDSL' | 'both'; // For products that need specific depository
}

const PRODUCT_REQUIREMENTS: Record<string, ProductRequirements> = {
  mutual_fund: { requiresBank: true, requiresDemat: false },
  ipo: { requiresBank: true, requiresDemat: true },
  bond: { requiresBank: true, requiresDemat: true },
  equity: { requiresBank: true, requiresDemat: true },
  aif: { requiresBank: true, requiresDemat: false },
  pms: { requiresBank: true, requiresDemat: false },
  unlisted_share: { requiresBank: true, requiresDemat: true },
  fd: { requiresBank: true, requiresDemat: false },
  loan: { requiresBank: true, requiresDemat: false },
};

export class ProductAccountService {
  constructor(private storage: IStorage) {}

  /**
   * Get the appropriate bank and demat accounts for a product type
   * Priority: User preference > First verified account > First active account
   */
  async getAccountsForProduct(
    userId: string,
    productType: string
  ): Promise<AccountSelection> {
    const requirements = PRODUCT_REQUIREMENTS[productType] || {
      requiresBank: true,
      requiresDemat: false,
    };

    let bankAccountId: string | null = null;
    let dematAccountId: string | null = null;

    // Try to get from user preferences first
    const preference = await this.storage.getProductAccountPreference(
      userId,
      productType
    );

    if (preference) {
      bankAccountId = preference.bankAccountId;
      dematAccountId = preference.dematAccountId;
    }

    // If no preference or preference incomplete, get default accounts
    if (requirements.requiresBank && !bankAccountId) {
      const bankAccounts = await this.storage.getUserBankAccounts(userId);
      const verifiedAccount = bankAccounts.find((acc) => acc.isVerified && acc.isActive);
      const activeAccount = bankAccounts.find((acc) => acc.isActive);
      bankAccountId = verifiedAccount?.id || activeAccount?.id || null;
    }

    if (requirements.requiresDemat && !dematAccountId) {
      const dematAccounts = await this.storage.getUserDematAccounts(userId);
      
      // Filter by depository type if required
      let filteredAccounts = dematAccounts;
      if (requirements.depositoryType && requirements.depositoryType !== 'both') {
        filteredAccounts = dematAccounts.filter(
          (acc) => acc.depositoryType === requirements.depositoryType
        );
      }

      const verifiedAccount = filteredAccounts.find((acc) => acc.isVerified && acc.isActive);
      const activeAccount = filteredAccounts.find((acc) => acc.isActive);
      dematAccountId = verifiedAccount?.id || activeAccount?.id || null;
    }

    // Fetch full account details
    const result: AccountSelection = {
      bankAccountId,
      dematAccountId,
    };

    if (bankAccountId) {
      result.bankAccount = await this.storage.getBankAccount(bankAccountId);
    }

    if (dematAccountId) {
      result.dematAccount = await this.storage.getDematAccount(dematAccountId);
    }

    return result;
  }

  /**
   * Validate that the required accounts are available and verified
   */
  async validateAccountsForProduct(
    userId: string,
    productType: string,
    bankAccountId?: string,
    dematAccountId?: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const requirements = PRODUCT_REQUIREMENTS[productType] || {
      requiresBank: true,
      requiresDemat: false,
    };

    const errors: string[] = [];

    // Validate bank account if required
    if (requirements.requiresBank) {
      if (!bankAccountId) {
        errors.push("Bank account is required for this product");
      } else {
        const bankAccount = await this.storage.getBankAccount(bankAccountId);
        if (!bankAccount) {
          errors.push("Bank account not found");
        } else if (!bankAccount.isActive) {
          errors.push("Bank account is not active");
        } else if (!bankAccount.isVerified) {
          errors.push("Bank account is not verified. Please complete verification first.");
        } else if (bankAccount.userId !== userId) {
          errors.push("Bank account does not belong to you");
        }
      }
    }

    // Validate demat account if required
    if (requirements.requiresDemat) {
      if (!dematAccountId) {
        errors.push("Demat account is required for this product");
      } else {
        const dematAccount = await this.storage.getDematAccount(dematAccountId);
        if (!dematAccount) {
          errors.push("Demat account not found");
        } else if (!dematAccount.isActive) {
          errors.push("Demat account is not active");
        } else if (!dematAccount.isVerified) {
          errors.push("Demat account is not verified. Please complete verification first.");
        } else if (dematAccount.userId !== userId) {
          errors.push("Demat account does not belong to you");
        } else if (
          requirements.depositoryType &&
          requirements.depositoryType !== 'both' &&
          dematAccount.depositoryType !== requirements.depositoryType
        ) {
          errors.push(
            `This product requires a ${requirements.depositoryType} demat account`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get product requirements for a given product type
   */
  getProductRequirements(productType: string): ProductRequirements {
    return PRODUCT_REQUIREMENTS[productType] || {
      requiresBank: true,
      requiresDemat: false,
    };
  }
}
