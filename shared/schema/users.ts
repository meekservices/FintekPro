import { pgTable, text, serial, varchar, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: varchar("email").unique(),
  mobile: varchar("mobile").unique(),
  role: varchar("role").default("user"), // user, agent, admin
  isEmailVerified: boolean("is_email_verified").default(false),
  isMobileVerified: boolean("is_mobile_verified").default(false),
  pinHash: text("pin_hash"),
  kycStatus: varchar("kyc_status"), // PENDING, VERIFIED, REJECTED
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
