/**
 * Auth Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for authentication,
 * user management, OTP verification, and password reset operations.
 *
 * Inputs:  storage singleton from the central DatabaseStorage class
 * Outputs: typed methods scoped to the auth domain
 * Edge cases: All methods delegate to storage — no business logic here
 *
 * @module data/auth-storage
 */

import { storage } from "../storage";
import type { IStorage } from "../storage-types";

type S = IStorage;

export const authStorage = {
	/** User CRUD */
	getUser: (...a: Parameters<S["getUser"]>) => storage.getUser(...a),
	getUserByUsername: (...a: Parameters<S["getUserByUsername"]>) => storage.getUserByUsername(...a),
	getUserByEmail: (...a: Parameters<S["getUserByEmail"]>) => storage.getUserByEmail(...a),
	getUserByMobile: (...a: Parameters<S["getUserByMobile"]>) => storage.getUserByMobile(...a),
	getUserByUserId: (...a: Parameters<S["getUserByUserId"]>) => storage.getUserByUserId(...a),
	getUserByPan: (...a: Parameters<S["getUserByPan"]>) => storage.getUserByPan(...a),
	getAllUsers: (...a: Parameters<S["getAllUsers"]>) => storage.getAllUsers(...a),
	createUser: (...a: Parameters<S["createUser"]>) => storage.createUser(...a),
	updateUser: (...a: Parameters<S["updateUser"]>) => storage.updateUser(...a),
	upsertUser: (...a: Parameters<S["upsertUser"]>) => storage.upsertUser(...a),
	deleteUser: (...a: Parameters<S["deleteUser"]>) => storage.deleteUser(...a),
	updateUserStatus: (...a: Parameters<S["updateUserStatus"]>) => storage.updateUserStatus(...a),
	updateUserRole: (...a: Parameters<S["updateUserRole"]>) => storage.updateUserRole(...a),

	/** User profile */
	getUserProfile: (...a: Parameters<S["getUserProfile"]>) => storage.getUserProfile(...a),
	upsertUserProfile: (...a: Parameters<S["upsertUserProfile"]>) => storage.upsertUserProfile(...a),

	/** OTP */
	createOtpVerification: (...a: Parameters<S["createOtpVerification"]>) =>
		storage.createOtpVerification(...a),
	getOtpVerification: (...a: Parameters<S["getOtpVerification"]>) =>
		storage.getOtpVerification(...a),
	verifyOtp: (...a: Parameters<S["verifyOtp"]>) => storage.verifyOtp(...a),
	cleanupExpiredOtps: (...a: Parameters<S["cleanupExpiredOtps"]>) =>
		storage.cleanupExpiredOtps(...a),

	/** Password reset */
	createPasswordResetToken: (...a: Parameters<S["createPasswordResetToken"]>) =>
		storage.createPasswordResetToken(...a),
	getPasswordResetToken: (...a: Parameters<S["getPasswordResetToken"]>) =>
		storage.getPasswordResetToken(...a),
	markPasswordResetTokenAsUsed: (...a: Parameters<S["markPasswordResetTokenAsUsed"]>) =>
		storage.markPasswordResetTokenAsUsed(...a),
	cleanupExpiredResetTokens: (...a: Parameters<S["cleanupExpiredResetTokens"]>) =>
		storage.cleanupExpiredResetTokens(...a),
} as const;
