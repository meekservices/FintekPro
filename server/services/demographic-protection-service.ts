// @ts-nocheck
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { users, ckycRecords } from "../../shared/schema";
import type { User } from "../../shared/schema";
import crypto from "crypto";

interface DemographicChangeRequest {
	userId: string;
	fieldName: string;
	currentValue: any;
	requestedValue: any;
	requestReason: string;
	ipAddress?: string;
	userAgent?: string;
	sessionId?: string;
}

interface CkycUpdateRequest {
	userId: string;
	changes: Record<string, any>;
	ckycDocuments?: string[];
	verificationMethod: "digilocker" | "manual_upload" | "video_kyc";
	reason: string;
}

/**
 * Service to protect demographic data and enforce re-CKYC workflow for changes
 */
export class DemographicProtectionService {
	/**
	 * List of demographic fields that require re-CKYC for changes
	 */
	private static readonly PROTECTED_DEMOGRAPHIC_FIELDS = [
		"panNumber",
		"aadharNumber",
		"dateOfBirth",
		"nationality",
		"fatherName",
		"motherName",
		"spouseName",
		"maritalStatus",
		"address",
		"city",
		"state",
		"country",
		"pincode",
		"countryOfResidence",
		"taxResidencyCountry",
		"passportNumber",
		"drivingLicense",
		"voterIdNumber",
		"residentStatus",
	];

	/**
	 * Check if a field is protected demographic data
	 */
	static isProtectedField(fieldName: string): boolean {
		return DemographicProtectionService.PROTECTED_DEMOGRAPHIC_FIELDS.includes(
			fieldName,
		);
	}

	/**
	 * Get list of protected demographic fields
	 */
	static getProtectedFields(): string[] {
		return [...DemographicProtectionService.PROTECTED_DEMOGRAPHIC_FIELDS];
	}

	/**
	 * Validate demographic change request (blocks direct changes)
	 */
	static validateDemographicChange(
		fieldName: string,
		userId: string,
	): {
		allowed: boolean;
		reason: string;
		requiresReCKYC: boolean;
	} {
		if (!DemographicProtectionService.isProtectedField(fieldName)) {
			return {
				allowed: true,
				reason: "Field is not protected demographic data",
				requiresReCKYC: false,
			};
		}

		return {
			allowed: false,
			reason:
				"Demographic data changes require re-CKYC verification for compliance",
			requiresReCKYC: true,
		};
	}

	/**
	 * Create demographic change request (initiates re-CKYC process)
	 */
	static async createDemographicChangeRequest(
		request: DemographicChangeRequest,
	): Promise<{
		success: boolean;
		reCkycRequestId?: string;
		message: string;
	}> {
		try {
			// Validate if field is protected
			const validation = DemographicProtectionService.validateDemographicChange(
				request.fieldName,
				request.userId,
			);

			if (!validation.requiresReCKYC) {
				return {
					success: false,
					message: "Field does not require re-CKYC protection",
				};
			}

			// Generate unique request ID
			const reCkycRequestId = crypto.randomUUID();

			// Create re-CKYC record in pending status
			await db.insert(ckycRecords).values({
				userId: request.userId,
				firstName: "User", // Required field
				lastName: "Update", // Required field
				dateOfBirth: new Date().toISOString().split("T")[0], // Required field
				panNumber: request.currentValue || "TEMP12345Z", // Required field
				mobileNumber: "1234567890", // Required field
				emailAddress: "user@example.com", // Required field
				addressLine1: "Update Request", // Required field
				city: "Update", // Required field
				state: "Update", // Required field
				pincode: "000000", // Required field
				ckycNumber: reCkycRequestId,
				status: "pending",
				remarks: JSON.stringify({
					[request.fieldName]: {
						current: request.currentValue,
						requested: request.requestedValue,
						reason: request.requestReason,
					},
				}),
			});

			// Log the demographic change attempt
			await DemographicProtectionService.logDemographicActivity({
				userId: request.userId,
				action: "demographic_change_requested",
				fieldName: request.fieldName,
				reCkycRequestId,
				details: {
					currentValue: request.currentValue,
					requestedValue: request.requestedValue,
					reason: request.requestReason,
				},
				ipAddress: request.ipAddress,
				userAgent: request.userAgent,
			});

			return {
				success: true,
				reCkycRequestId,
				message:
					"Demographic change request created. Re-CKYC verification required.",
			};
		} catch (error) {
			console.error("Error creating demographic change request:", error);
			return {
				success: false,
				message: "Failed to create demographic change request",
			};
		}
	}

	/**
	 * Process re-CKYC update (after verification)
	 */
	static async processReCkycUpdate(request: CkycUpdateRequest): Promise<{
		success: boolean;
		message: string;
		updatedFields?: string[];
	}> {
		try {
			const { userId, changes, reason, verificationMethod } = request;

			// Validate all changes are for protected fields
			const protectedChanges: Record<string, any> = {};
			const invalidFields: string[] = [];

			for (const [fieldName, value] of Object.entries(changes)) {
				if (DemographicProtectionService.isProtectedField(fieldName)) {
					protectedChanges[fieldName] = value;
				} else {
					invalidFields.push(fieldName);
				}
			}

			if (invalidFields.length > 0) {
				return {
					success: false,
					message: `Invalid fields for re-CKYC update: ${invalidFields.join(", ")}`,
				};
			}

			// Update user profile with new demographic data
			await db
				.update(users)
				.set({
					...protectedChanges,
					updatedAt: new Date(),
				})
				.where(eq(users.id, userId));

			// Create successful re-CKYC record
			const reCkycRecordId = crypto.randomUUID();
			await db.insert(ckycRecords).values({
				userId,
				firstName: changes.firstName || "User",
				lastName: changes.lastName || "Updated",
				dateOfBirth:
					changes.dateOfBirth || new Date().toISOString().split("T")[0],
				panNumber: changes.panNumber || "UPDATED123Z",
				mobileNumber: "1234567890",
				emailAddress: "updated@example.com",
				addressLine1: changes.address || "Updated Address",
				city: changes.city || "Updated City",
				state: changes.state || "Updated State",
				pincode: changes.pincode || "000000",
				ckycNumber: reCkycRecordId,
				status: "verified",
				remarks: `Demographic update completed: ${reason}`,
			});

			// Log successful demographic update
			await DemographicProtectionService.logDemographicActivity({
				userId,
				action: "demographic_updated_via_re_ckyc",
				fieldName: Object.keys(protectedChanges).join(", "),
				reCkycRequestId: reCkycRecordId,
				details: {
					updatedFields: Object.keys(protectedChanges),
					verificationMethod,
					reason,
				},
			});

			return {
				success: true,
				message: "Demographic data updated successfully via re-CKYC",
				updatedFields: Object.keys(protectedChanges),
			};
		} catch (error) {
			console.error("Error processing re-CKYC update:", error);
			return {
				success: false,
				message: "Failed to process re-CKYC update",
			};
		}
	}

	/**
	 * Check user's re-CKYC eligibility and status
	 */
	static async getUserReCkycStatus(userId: string): Promise<{
		isEligibleForReCkyc: boolean;
		hasPendingRequests: boolean;
		pendingRequests: any[];
		lastReCkycDate?: Date;
		reCkycRequired: boolean;
		reasonsForReCkyc: string[];
	}> {
		try {
			// Get user's pending re-CKYC requests
			const pendingRequests = await db.query.ckycRecords.findMany({
				where: and(
					eq(ckycRecords.userId, userId),
					eq(ckycRecords.status, "pending"),
				),
				orderBy: (table, { desc }) => [desc(table.createdAt)],
				limit: 10,
			});

			// Get last successful re-CKYC
			const lastReCkyc = await db.query.ckycRecords.findFirst({
				where: and(
					eq(ckycRecords.userId, userId),
					eq(ckycRecords.status, "verified"),
				),
				orderBy: (table, { desc }) => [desc(table.lastVerifiedAt)],
			});

			const reasonsForReCkyc: string[] = [];

			// Check if re-CKYC is required (more than 1 year old)
			let reCkycRequired = false;
			if (!lastReCkyc) {
				reCkycRequired = true;
				reasonsForReCkyc.push("Initial CKYC not completed");
			} else if (lastReCkyc.lastVerifiedAt) {
				const oneYearAgo = new Date();
				oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

				if (lastReCkyc.lastVerifiedAt < oneYearAgo) {
					reCkycRequired = true;
					reasonsForReCkyc.push("CKYC data is older than 1 year");
				}
			}

			return {
				isEligibleForReCkyc: true, // Always eligible for re-CKYC
				hasPendingRequests: pendingRequests.length > 0,
				pendingRequests: pendingRequests.map((req) => ({
					id: req.id,
					remarks: req.remarks,
					createdAt: req.createdAt,
					status: req.status,
				})),
				lastReCkycDate: lastReCkyc?.lastVerifiedAt || undefined,
				reCkycRequired,
				reasonsForReCkyc,
			};
		} catch (error) {
			console.error("Error getting re-CKYC status:", error);
			return {
				isEligibleForReCkyc: false,
				hasPendingRequests: false,
				pendingRequests: [],
				reCkycRequired: true,
				reasonsForReCkyc: ["Error checking CKYC status"],
			};
		}
	}

	/**
	 * Log demographic data activity for audit trail
	 */
	private static async logDemographicActivity(activity: {
		userId: string;
		action: string;
		fieldName?: string;
		reCkycRequestId?: string;
		details?: any;
		ipAddress?: string;
		userAgent?: string;
	}): Promise<void> {
		try {
			// In a real implementation, this would go to a dedicated audit log table
			console.log(
				`[DEMOGRAPHIC_AUDIT] User: ${activity.userId}, Action: ${activity.action}`,
				{
					fieldName: activity.fieldName,
					reCkycRequestId: activity.reCkycRequestId,
					details: activity.details,
					timestamp: new Date().toISOString(),
					ipAddress: activity.ipAddress,
				},
			);

			// TODO: Implement proper audit logging table
			// For now, we log to console for transparency
		} catch (error) {
			console.error("Error logging demographic activity:", error);
			// Don't throw here to avoid breaking main operations
		}
	}

	/**
	 * Get demographic change restrictions for UI display
	 */
	static getDemographicFieldRestrictions(): Record<
		string,
		{
			isProtected: boolean;
			restrictionMessage: string;
			reCkycRequired: boolean;
		}
	> {
		const restrictions: Record<string, any> = {};

		DemographicProtectionService.PROTECTED_DEMOGRAPHIC_FIELDS.forEach(
			(field) => {
				restrictions[field] = {
					isProtected: true,
					restrictionMessage:
						"This field can only be updated through re-CKYC verification for regulatory compliance",
					reCkycRequired: true,
				};
			},
		);

		return restrictions;
	}

	/**
	 * Validate bulk demographic changes (for profile updates)
	 */
	static validateBulkDemographicChanges(changes: Record<string, any>): {
		allowedChanges: Record<string, any>;
		restrictedChanges: Record<string, any>;
		requiresReCkyc: boolean;
	} {
		const allowedChanges: Record<string, any> = {};
		const restrictedChanges: Record<string, any> = {};
		let requiresReCkyc = false;

		for (const [fieldName, value] of Object.entries(changes)) {
			if (DemographicProtectionService.isProtectedField(fieldName)) {
				restrictedChanges[fieldName] = value;
				requiresReCkyc = true;
			} else {
				allowedChanges[fieldName] = value;
			}
		}

		return {
			allowedChanges,
			restrictedChanges,
			requiresReCkyc,
		};
	}
}
