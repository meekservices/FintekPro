/**
 * probe42.adapter.ts — backward-compat re-export shim
 *
 * All business logic has been migrated from Probe42 to Credhive.
 * This file re-exports the Credhive adapter and its types under the
 * legacy `probe42Adapter` / `CorporateDataProvider` names so that
 * existing import sites continue to compile without modification.
 *
 * New code should import directly from credhive.adapter.ts.
 */

export type {
  CorporateDataProvider,
  CompanyProfile,
  FinancialStatement,
  FinancialRatios,
  Director,
  Charge,
} from './credhive.adapter';

export { credhiveAdapter as probe42Adapter } from './credhive.adapter';
