import { db } from "../db";
import { users } from "@shared/schema";
import { encryptionService } from "../encryption-service";
import { sql } from "drizzle-orm";

/**
 * ONE-TIME MIGRATION SCRIPT
 * Encrypts existing plaintext PII data (PAN, Aadhaar, Bank Account Numbers)
 *
 * IMPORTANT: Run this ONCE before production deployment
 * This script:
 * 1. Identifies users with plaintext PII data
 * 2. Encrypts the data using AES-256-GCM
 * 3. Updates records with encrypted values
 * 4. Logs migration progress and errors
 */

interface MigrationStats {
	total: number;
	encrypted: number;
	skipped: number;
	errors: number;
	errorDetails: Array<{ userId: string; error: string }>;
}

async function migratePIIEncryption(): Promise<MigrationStats> {
	console.log("🔐 Starting PII encryption migration...\n");

	const stats: MigrationStats = {
		total: 0,
		encrypted: 0,
		skipped: 0,
		errors: 0,
		errorDetails: [],
	};

	try {
		// Fetch all users (we'll check each one for plaintext data)
		const allUsers = await db
			.select({
				id: users.id,
				userId: users.userId,
				panNumber: users.panNumber,
				aadharNumber: users.aadharNumber,
				bankAccountNumber: users.bankAccountNumber,
			})
			.from(users);

		stats.total = allUsers.length;
		console.log(`📊 Found ${stats.total} users to check\n`);

		for (const user of allUsers) {
			try {
				// Check if data is already encrypted (base64 encoded, typically longer than plaintext)
				const isPanEncrypted = user.panNumber && user.panNumber.length > 50;
				const isAadhaarEncrypted =
					user.aadharNumber && user.aadharNumber.length > 50;
				const isBankEncrypted =
					user.bankAccountNumber && user.bankAccountNumber.length > 50;

				// Skip if all data is already encrypted or empty
				if (
					(!user.panNumber || isPanEncrypted) &&
					(!user.aadharNumber || isAadhaarEncrypted) &&
					(!user.bankAccountNumber || isBankEncrypted)
				) {
					stats.skipped++;
					console.log(
						`⏭️  Skipped user ${user.userId} - already encrypted or no PII data`,
					);
					continue;
				}

				// Encrypt plaintext data
				const encryptedData = encryptionService.encryptPII({
					pan: !isPanEncrypted ? user.panNumber : undefined,
					aadhaar: !isAadhaarEncrypted ? user.aadharNumber : undefined,
					bankAccount: !isBankEncrypted ? user.bankAccountNumber : undefined,
				});

				// Update database with encrypted values
				const updateData: any = {};
				if (encryptedData.pan) updateData.panNumber = encryptedData.pan;
				if (encryptedData.aadhaar)
					updateData.aadharNumber = encryptedData.aadhaar;
				if (encryptedData.bankAccount)
					updateData.bankAccountNumber = encryptedData.bankAccount;

				if (Object.keys(updateData).length > 0) {
					await db
						.update(users)
						.set(updateData)
						.where(sql`${users.id} = ${user.id}`);

					stats.encrypted++;
					console.log(`✅ Encrypted PII for user ${user.userId}`);
				}
			} catch (error) {
				stats.errors++;
				const errorMsg = error instanceof Error ? error.message : String(error);
				stats.errorDetails.push({
					userId: user.userId || user.id.toString(),
					error: errorMsg,
				});
				console.error(`❌ Error encrypting user ${user.userId}:`, errorMsg);
			}
		}

		// Print summary
		console.log("\n" + "=".repeat(60));
		console.log("📊 MIGRATION SUMMARY");
		console.log("=".repeat(60));
		console.log(`Total users checked:  ${stats.total}`);
		console.log(`Successfully encrypted: ${stats.encrypted}`);
		console.log(`Skipped (already encrypted): ${stats.skipped}`);
		console.log(`Errors: ${stats.errors}`);

		if (stats.errors > 0) {
			console.log("\n❌ ERROR DETAILS:");
			stats.errorDetails.forEach(({ userId, error }) => {
				console.log(`  - User ${userId}: ${error}`);
			});
		}

		console.log("=".repeat(60));

		if (stats.errors === 0) {
			console.log("\n✅ Migration completed successfully!");
		} else {
			console.log(
				"\n⚠️  Migration completed with errors. Please review error details above.",
			);
		}
	} catch (error) {
		console.error("\n❌ CRITICAL ERROR during migration:", error);
		throw error;
	}

	return stats;
}

// Execute migration if run directly
if (require.main === module) {
	migratePIIEncryption()
		.then((stats) => {
			if (stats.errors === 0) {
				process.exit(0);
			} else {
				console.error("\n⚠️  Migration had errors. Exit code: 1");
				process.exit(1);
			}
		})
		.catch((error) => {
			console.error("\n💥 Migration failed:", error);
			process.exit(1);
		});
}

export { migratePIIEncryption };
