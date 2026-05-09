import { sql } from 'drizzle-orm';

/**
 * Generate a unique deal ticket in FTX-UNL-XXXXX format using PostgreSQL sequence
 * XXXXX is a 5-digit zero-padded sequential number
 * 
 * This function must be called within a transaction context (tx)
 * to ensure atomicity and avoid race conditions.
 */
export async function generateDealTicket(tx: any): Promise<string> {
  const PREFIX = 'FTX-UNL-';
  
  // Create sequence if it doesn't exist (idempotent)
  await tx.execute(sql`
    CREATE SEQUENCE IF NOT EXISTS unlisted_deal_ticket_seq START WITH 1;
  `);
  
  // Get next value from sequence (atomic, thread-safe)
  const result = await tx.execute(sql`SELECT nextval('unlisted_deal_ticket_seq') as ticket_num`);
  const ticketNum = result.rows[0]?.ticket_num || 1;
  
  // Format as 5-digit zero-padded number
  const ticketNumber = String(ticketNum).padStart(5, '0');
  const dealTicket = `${PREFIX}${ticketNumber}`;
  
  return dealTicket;
}
