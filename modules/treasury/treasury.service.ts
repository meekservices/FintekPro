import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../server/db';
import { treasuryEntities, treasuryAccounts } from '../../shared/schema/treasury';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  async createEntity(data: {
    tenantId: string;
    name: string;
    type: 'subsidiary' | 'parent' | 'holding';
    taxId?: string;
  }) {
    const [entity] = await db.insert(treasuryEntities).values({
      tenantId: data.tenantId,
      name: data.name,
      type: data.type,
      taxId: data.taxId,
      status: 'active',
      config: {}
    }).returning();

    return entity;
  }

  async getEntitiesByTenant(tenantId: string) {
    return db.select().from(treasuryEntities).where(eq(treasuryEntities.tenantId, tenantId));
  }

  async linkBankAccount(entityId: string, data: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    accountType: string;
    currency: string;
    provider: string;
    providerAccountId: string;
  }) {
    const [account] = await db.insert(treasuryAccounts).values({
      entityId,
      bankName: data.bankName,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      accountType: data.accountType as any,
      currency: data.currency,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      status: 'active'
    }).returning();

    return account;
  }

  async getEntityAccounts(entityId: string) {
    return db.select().from(treasuryAccounts).where(eq(treasuryAccounts.entityId, entityId));
  }
}
