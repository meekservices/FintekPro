import { db } from "./db";
import { customerCareAgents } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDefaultAgent(): Promise<void> {
  try {
    // Check if the default agent already exists
    const existingAgent = await db
      .select()
      .from(customerCareAgents)
      .where(eq(customerCareAgents.email, "sangram.m@outlook.com"))
      .limit(1);

    if (existingAgent.length > 0) {
      console.log("✅ Default agent (Sangram Kesari Mohanty) already exists");
      return;
    }

    // Insert the default agent
    await db.insert(customerCareAgents).values({
      fullName: "Sangram Kesari Mohanty",
      email: "sangram.m@outlook.com",
      euinNumber: "E317634",
      arnCode: "ARN-0002",
      distributorId: "ARN0002",
      status: "active",
      specializations: [],
      languages: ["en"],
      maxTicketsPerDay: 100,
      currentTicketCount: 0,
      totalTicketsHandled: 0,
    });

    console.log("✅ Default agent (Sangram Kesari Mohanty) created successfully");
  } catch (error) {
    console.error("⚠️ Error seeding default agent:", error instanceof Error ? error.message : "Unknown error");
  }
}
