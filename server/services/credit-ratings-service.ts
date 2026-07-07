import { db } from "../db";
import { creditRatings, bondCatalog } from "@shared/schema";
import { sql, eq, desc } from "drizzle-orm";
import { type CreditRating, type InsertCreditRating } from "@shared/schema";

export class CreditRatingsService {
	async seedCreditRatings() {
		console.log("🌱 Seeding credit ratings from bond_catalog...");
		try {
			// Using raw SQL for the specific ON CONFLICT requirement and complex SELECT
			// We check if the rating exists for the ISIN, Agency, and Date to avoid duplicates
			await db.execute(sql`
        INSERT INTO credit_ratings (isin, instrument_name, rating, rating_outlook, agency, rating_date, rating_action, is_current, source)
        SELECT 
          isin, 
          bond_name, 
          credit_rating, 
          outlook_status, 
          COALESCE(rating_agency, 'UNKNOWN'), 
          COALESCE(rating_date, CURRENT_DATE), 
          'Assigned', 
          true, 
          'bonds_table'
        FROM bond_catalog
        WHERE isin IS NOT NULL AND credit_rating IS NOT NULL
        ON CONFLICT DO NOTHING
      `);
			console.log("✅ Credit ratings seeded successfully.");
		} catch (error) {
			console.error("❌ Failed to seed credit ratings:", error);
			throw error;
		}
	}

	async getCurrentRating(isin: string): Promise<CreditRating | null> {
		const results = await db
			.select()
			.from(creditRatings)
			.where(
				sql`${creditRatings.isin} = ${isin} AND ${creditRatings.isCurrent} = true`,
			)
			.limit(1);

		return results[0] || null;
	}

	async getRatingHistory(isin: string): Promise<CreditRating[]> {
		return await db
			.select()
			.from(creditRatings)
			.where(eq(creditRatings.isin, isin))
			.orderBy(desc(creditRatings.ratingDate));
	}

	async upsertRating(data: InsertCreditRating) {
		return await db.transaction(async (tx) => {
			// 1. Get current rating
			const currentRating = await tx
				.select()
				.from(creditRatings)
				.where(
					sql`${creditRatings.isin} = ${data.isin} AND ${creditRatings.isCurrent} = true`,
				)
				.limit(1);

			// 2. Set is_current = false for all previous ratings
			await tx
				.update(creditRatings)
				.set({ isCurrent: false })
				.where(eq(creditRatings.isin, data.isin));

			// 3. Determine rating action if not provided
			let ratingAction = data.ratingAction || "Assigned";
			let previousRating = data.previousRating;

			if (currentRating.length > 0) {
				previousRating = currentRating[0].rating;
				if (!data.ratingAction) {
					// Simple heuristic for rating action
					if (data.rating === previousRating) {
						ratingAction = "Affirmed";
					} else {
						// In a real app, we'd have a rating scale comparison here
						ratingAction = "Revised";
					}
				}
			}

			// 4. Insert new rating
			const [newRating] = await tx
				.insert(creditRatings)
				.values({
					...data,
					previousRating,
					ratingAction,
					isCurrent: true,
				})
				.returning();

			return newRating;
		});
	}
}

export const creditRatingsService = new CreditRatingsService();
