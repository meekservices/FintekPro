/**
 * Tax Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for tax-related data:
 * capital gains reports, tax documents, structured tax data,
 * tax calculations, and ITR/TDS records.
 *
 * @module data/tax-storage
 */

import { storage } from "../storage";
import type { IStorage } from "../storage-types";

type S = IStorage;

export const taxStorage = {
	/** Capital gains */
	createCapitalGainsReport: (...a: Parameters<S["createCapitalGainsReport"]>) =>
		storage.createCapitalGainsReport(...a),
	getCapitalGainsReports: (...a: Parameters<S["getCapitalGainsReports"]>) =>
		storage.getCapitalGainsReports(...a),
	getCapitalGainsReport: (...a: Parameters<S["getCapitalGainsReport"]>) =>
		storage.getCapitalGainsReport(...a),
	updateCapitalGainsReport: (...a: Parameters<S["updateCapitalGainsReport"]>) =>
		storage.updateCapitalGainsReport(...a),

	/** Tax documents */
	createTaxDocument: (...a: Parameters<S["createTaxDocument"]>) =>
		storage.createTaxDocument(...a),
	getTaxDocuments: (...a: Parameters<S["getTaxDocuments"]>) => storage.getTaxDocuments(...a),
	getTaxDocument: (...a: Parameters<S["getTaxDocument"]>) => storage.getTaxDocument(...a),
	updateTaxDocument: (...a: Parameters<S["updateTaxDocument"]>) =>
		storage.updateTaxDocument(...a),
	deleteTaxDocument: (...a: Parameters<S["deleteTaxDocument"]>) =>
		storage.deleteTaxDocument(...a),

	/** Structured tax data */
	createStructuredTaxData: (...a: Parameters<S["createStructuredTaxData"]>) =>
		storage.createStructuredTaxData(...a),
	getStructuredTaxData: (...a: Parameters<S["getStructuredTaxData"]>) =>
		storage.getStructuredTaxData(...a),
	getStructuredTaxDataByUser: (...a: Parameters<S["getStructuredTaxDataByUser"]>) =>
		storage.getStructuredTaxDataByUser(...a),
	updateStructuredTaxData: (...a: Parameters<S["updateStructuredTaxData"]>) =>
		storage.updateStructuredTaxData(...a),
	deleteStructuredTaxData: (...a: Parameters<S["deleteStructuredTaxData"]>) =>
		storage.deleteStructuredTaxData(...a),

	/** Tax calculations */
	createTaxCalculation: (...a: Parameters<S["createTaxCalculation"]>) =>
		storage.createTaxCalculation(...a),
	getTaxCalculations: (...a: Parameters<S["getTaxCalculations"]>) =>
		storage.getTaxCalculations(...a),
	getTaxCalculation: (...a: Parameters<S["getTaxCalculation"]>) =>
		storage.getTaxCalculation(...a),
	updateTaxCalculation: (...a: Parameters<S["updateTaxCalculation"]>) =>
		storage.updateTaxCalculation(...a),
	deleteTaxCalculation: (...a: Parameters<S["deleteTaxCalculation"]>) =>
		storage.deleteTaxCalculation(...a),
} as const;
