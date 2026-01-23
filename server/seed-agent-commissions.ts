import { db } from "./db";
import { agentCommissions, clientAgentRelationships } from "@shared/schema";
import { nanoid } from "nanoid";

const AGENT_ID = "89c8a73b-9dc6-4123-a0c4-57b0e29a917a";
const CLIENT_IDS = [
  "31b465f8-582a-4709-b169-9156e8de64c6",
  "dc41e192-05de-481c-b1cc-947d8ea42cff"
];

const PRODUCT_TYPES = [
  'mutual_funds',
  'pms',
  'aif',
  'bonds',
  'unlisted',
  'equity'
];

const TRANSACTION_TYPES = ['purchase', 'sip', 'renewal'];

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month >= 3) {
    return `FY${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `FY${year - 1}-${year.toString().slice(-2)}`;
}

async function seedAgentCommissions() {
  console.log("🌱 Seeding agent commissions data...");
  
  // Check if data already exists
  const existing = await db.select().from(agentCommissions).limit(1);
  if (existing.length > 0) {
    console.log("⚠️ Commission data already exists, skipping seed");
    return;
  }
  
  // First, create client-agent relationships if they don't exist
  for (const clientId of CLIENT_IDS) {
    try {
      await db.insert(clientAgentRelationships).values({
        id: nanoid(),
        clientId,
        agentId: AGENT_ID,
        euinNumber: `E${Math.floor(100000 + Math.random() * 900000)}`,
        arnCode: `ARN-${Math.floor(10000 + Math.random() * 90000)}`,
        relationshipType: 'primary',
        isActive: true
      }).onConflictDoNothing();
      console.log(`✅ Created relationship for client ${clientId}`);
    } catch (error: any) {
      console.log(`ℹ️ Client relationship may already exist: ${error.message}`);
    }
  }
  
  // Generate commission records for the last 12 months
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  
  const commissionRecords = [];
  
  // Generate 50-100 commission records
  const recordCount = 50 + Math.floor(Math.random() * 50);
  
  for (let i = 0; i < recordCount; i++) {
    const transactionDate = randomDate(oneYearAgo, now);
    const productType = PRODUCT_TYPES[Math.floor(Math.random() * PRODUCT_TYPES.length)];
    const transactionType = TRANSACTION_TYPES[Math.floor(Math.random() * TRANSACTION_TYPES.length)];
    const clientId = CLIENT_IDS[Math.floor(Math.random() * CLIENT_IDS.length)];
    
    // Transaction amounts vary by product type
    let baseAmount: number;
    switch (productType) {
      case 'pms':
      case 'aif':
        baseAmount = 5000000 + Math.random() * 20000000; // 50L - 2.5Cr
        break;
      case 'mutual_funds':
        baseAmount = 100000 + Math.random() * 2000000; // 1L - 20L
        break;
      case 'bonds':
        baseAmount = 500000 + Math.random() * 5000000; // 5L - 50L
        break;
      case 'unlisted':
        baseAmount = 200000 + Math.random() * 3000000; // 2L - 30L
        break;
      default:
        baseAmount = 50000 + Math.random() * 500000; // 50K - 5L
    }
    
    const transactionAmount = Math.round(baseAmount);
    
    // Commission rates vary by product (0.5% - 2.5%)
    const commissionRate = 0.5 + Math.random() * 2;
    const totalCommission = Math.round(transactionAmount * (commissionRate / 100));
    
    // Agent gets 70-85% of total commission
    const agentCommissionRate = 70 + Math.random() * 15;
    const agentCommission = Math.round(totalCommission * (agentCommissionRate / 100));
    
    // TDS at 5%
    const tdsAmount = Math.round(agentCommission * 0.05);
    const netCommission = agentCommission - tdsAmount;
    
    // Settlement status - older ones more likely to be settled
    const daysSinceTransaction = Math.floor((now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
    const settlementStatus = daysSinceTransaction > 30 && Math.random() > 0.3 ? 'settled' : 'pending';
    
    commissionRecords.push({
      id: nanoid(),
      agentId: AGENT_ID,
      masterAgentId: null,
      clientId,
      orderId: `ORD-${nanoid(8).toUpperCase()}`,
      productType,
      transactionType,
      transactionAmount: transactionAmount.toString(),
      totalCommissionAmount: totalCommission.toString(),
      agentCommissionRate: agentCommissionRate.toFixed(2),
      agentCommissionAmount: agentCommission.toString(),
      agentTdsAmount: tdsAmount.toString(),
      agentNetCommission: netCommission.toString(),
      masterCommissionRate: "0.00",
      masterCommissionAmount: "0.00",
      masterTdsAmount: "0.00",
      masterNetCommission: "0.00",
      agentSettlementStatus: settlementStatus,
      masterSettlementStatus: 'pending',
      agentSettledAt: settlementStatus === 'settled' ? new Date(transactionDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
      transactionDate,
      month: getMonthString(transactionDate),
      financialYear: getFinancialYear(transactionDate)
    });
  }
  
  // Insert in batches
  const batchSize = 20;
  for (let i = 0; i < commissionRecords.length; i += batchSize) {
    const batch = commissionRecords.slice(i, i + batchSize);
    await db.insert(agentCommissions).values(batch);
    console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(commissionRecords.length / batchSize)}`);
  }
  
  console.log(`✅ Seeded ${commissionRecords.length} commission records`);
  
  // Calculate totals for verification
  const pendingTotal = commissionRecords
    .filter(r => r.agentSettlementStatus === 'pending')
    .reduce((sum, r) => sum + parseFloat(r.agentNetCommission), 0);
  
  const settledTotal = commissionRecords
    .filter(r => r.agentSettlementStatus === 'settled')
    .reduce((sum, r) => sum + parseFloat(r.agentNetCommission), 0);
  
  console.log(`📊 Summary:`);
  console.log(`   Pending Commissions: ₹${Math.round(pendingTotal).toLocaleString()}`);
  console.log(`   Settled Commissions: ₹${Math.round(settledTotal).toLocaleString()}`);
  console.log(`   Total Revenue: ₹${Math.round(pendingTotal + settledTotal).toLocaleString()}`);
}

seedAgentCommissions()
  .then(() => {
    console.log("✅ Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
