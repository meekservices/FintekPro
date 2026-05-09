import { corporateBonds, fixedIncomeStatusLog } from '@shared/schema';
import type { InferSelectModel } from 'drizzle-orm';

export type CorporateBond = InferSelectModel<typeof corporateBonds>;
export type FixedIncomeLog = InferSelectModel<typeof fixedIncomeStatusLog>;

export interface StatusSummary {
  SELLABLE: number;
  VISIBLE: number;
  HIDDEN: number;
  total: number;
}
