/**
 * @file user.repository.ts
 * @description Domain Repository for User Accounts, Profiles, and Authentication.
 */

import { eq, or } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { users, type User } from "@shared/schema/users";

export class UserRepository extends BaseRepository {
	/**
	 * Find user by ID
	 */
	async findById(id: string): Promise<User | null> {
		return this.withTelemetry("findById", async () => {
			const rows = await this.db
				.select()
				.from(users)
				.where(eq(users.id, id))
				.limit(1);
			return rows[0] || null;
		});
	}

	/**
	 * Find user by email or username/userId
	 */
	async findByUsernameOrEmail(identifier: string): Promise<User | null> {
		return this.withTelemetry("findByUsernameOrEmail", async () => {
			const rows = await this.db
				.select()
				.from(users)
				.where(
					or(
						eq(users.userId, identifier),
						eq(users.email, identifier),
					),
				)
				.limit(1);
			return rows[0] || null;
		});
	}

	/**
	 * Update user profile
	 */
	async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
		return this.withTelemetry("updateUser", async () => {
			const rows = await this.db
				.update(users)
				.set({
					...updates,
					updatedAt: new Date(),
				})
				.where(eq(users.id, id))
				.returning();
			return rows[0] || null;
		});
	}
}

export const userRepository = new UserRepository();

