/**
 * KYC Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for KYC verification,
 * CKYC records, PAN verification, and manual KYC submission operations.
 *
 * @module data/kyc-storage
 */

import { storage } from "../storage";
import type { IStorage } from "../storage-types";

type S = IStorage;

export const kycStorage = {
	/** PAN verification consent */
	checkPanVerificationConsent: (...a: Parameters<S["checkPanVerificationConsent"]>) =>
		storage.checkPanVerificationConsent(...a),
	recordPanVerificationConsent: (...a: Parameters<S["recordPanVerificationConsent"]>) =>
		storage.recordPanVerificationConsent(...a),

	/** CKYC records */
	getCkycRecord: (...a: Parameters<S["getCkycRecord"]>) => storage.getCkycRecord(...a),
	createCkycRecord: (...a: Parameters<S["createCkycRecord"]>) => storage.createCkycRecord(...a),
	updateCkycRecord: (...a: Parameters<S["updateCkycRecord"]>) => storage.updateCkycRecord(...a),
	getAllCkycRecords: (...a: Parameters<S["getAllCkycRecords"]>) => storage.getAllCkycRecords(...a),
	getCkycDocuments: (...a: Parameters<S["getCkycDocuments"]>) => storage.getCkycDocuments(...a),
	addCkycDocument: (...a: Parameters<S["addCkycDocument"]>) => storage.addCkycDocument(...a),
	getCkycStatusHistory: (...a: Parameters<S["getCkycStatusHistory"]>) =>
		storage.getCkycStatusHistory(...a),
	addCkycStatusHistory: (...a: Parameters<S["addCkycStatusHistory"]>) =>
		storage.addCkycStatusHistory(...a),
	getCkycNotificationTriggers: (...a: Parameters<S["getCkycNotificationTriggers"]>) =>
		storage.getCkycNotificationTriggers(...a),

	/** KYC verification sessions */
	createKycVerificationSession: (...a: Parameters<S["createKycVerificationSession"]>) =>
		storage.createKycVerificationSession(...a),
	getKycVerificationSession: (...a: Parameters<S["getKycVerificationSession"]>) =>
		storage.getKycVerificationSession(...a),
	getActiveKycSession: (...a: Parameters<S["getActiveKycSession"]>) =>
		storage.getActiveKycSession(...a),
	updateKycVerificationSession: (...a: Parameters<S["updateKycVerificationSession"]>) =>
		storage.updateKycVerificationSession(...a),
	updateKycSessionStepStatus: (...a: Parameters<S["updateKycSessionStepStatus"]>) =>
		storage.updateKycSessionStepStatus(...a),
	completeKycSession: (...a: Parameters<S["completeKycSession"]>) =>
		storage.completeKycSession(...a),
	deactivateAllUserKycSessions: (...a: Parameters<S["deactivateAllUserKycSessions"]>) =>
		storage.deactivateAllUserKycSessions(...a),

	/** Manual KYC submissions */
	createManualKycSubmission: (...a: Parameters<S["createManualKycSubmission"]>) =>
		storage.createManualKycSubmission(...a),
	getManualKycSubmission: (...a: Parameters<S["getManualKycSubmission"]>) =>
		storage.getManualKycSubmission(...a),
	getUserManualKycSubmissions: (...a: Parameters<S["getUserManualKycSubmissions"]>) =>
		storage.getUserManualKycSubmissions(...a),
	getAllManualKycSubmissions: (...a: Parameters<S["getAllManualKycSubmissions"]>) =>
		storage.getAllManualKycSubmissions(...a),
	updateManualKycSubmission: (...a: Parameters<S["updateManualKycSubmission"]>) =>
		storage.updateManualKycSubmission(...a),
	reviewManualKycSubmission: (...a: Parameters<S["reviewManualKycSubmission"]>) =>
		storage.reviewManualKycSubmission(...a),
	createManualKycDocument: (...a: Parameters<S["createManualKycDocument"]>) =>
		storage.createManualKycDocument(...a),
	getManualKycDocuments: (...a: Parameters<S["getManualKycDocuments"]>) =>
		storage.getManualKycDocuments(...a),
	updateManualKycDocument: (...a: Parameters<S["updateManualKycDocument"]>) =>
		storage.updateManualKycDocument(...a),
	getKycDashboardStats: (...a: Parameters<S["getKycDashboardStats"]>) =>
		storage.getKycDashboardStats(...a),
} as const;
