import { db } from "../db";
import { bankerConfirmationEmails, payoutClaims, leadRegistry, leadAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "../email-service";

export class BankerConfirmationService {
  private static instance: BankerConfirmationService;

  static getInstance(): BankerConfirmationService {
    if (!this.instance) this.instance = new BankerConfirmationService();
    return this.instance;
  }

  async triggerBankerConfirmation(claimId: string): Promise<{ success: boolean; emailId?: string; error?: string }> {
    const [claim] = await db.select().from(payoutClaims).where(eq(payoutClaims.claimId, claimId));
    if (!claim) return { success: false, error: "Claim not found" };

    const [lead] = await db.select().from(leadRegistry).where(eq(leadRegistry.leadId, claim.leadId));
    if (!lead) return { success: false, error: "Lead not found" };

    if (!lead.bankerEmail) {
      return { success: false, error: "Banker email not set on lead. Set financier details first." };
    }

    const emailSubject = `FintekPro – Disbursement Confirmation Required | ${lead.customerName} | ${claim.financierName}`;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a365d; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">FintekPro – Disbursement Confirmation</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e2e8f0;">
          <p>Dear ${lead.bankerName || 'Banker'},</p>
          <p>We are writing to confirm the following loan disbursement processed through our platform partner network:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold; width: 40%;">Customer Name</td>
              <td style="padding: 8px;">${lead.customerName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Loan Type</td>
              <td style="padding: 8px;">${lead.loanType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Financier</td>
              <td style="padding: 8px;">${claim.financierName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Disbursement Amount</td>
              <td style="padding: 8px;">₹${Number(claim.disbursementAmount).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Disbursement Date</td>
              <td style="padding: 8px;">${claim.disbursementDate}</td>
            </tr>
            ${claim.loanAccountNumber ? `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Loan A/C No.</td>
              <td style="padding: 8px;">${claim.loanAccountNumber}</td>
            </tr>` : ''}
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">PDD Status</td>
              <td style="padding: 8px;">${claim.pddStatus}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px; font-weight: bold;">Claim Reference</td>
              <td style="padding: 8px;">${claim.claimId}</td>
            </tr>
          </table>
          <p><strong>Please reply to this email confirming:</strong></p>
          <ol>
            <li>Whether the above disbursement details are accurate</li>
            <li>Whether PDD (Post Disbursement Documents) have been completed</li>
            <li>If PDD is pending, whether payout can still be processed (exception basis)</li>
          </ol>
          <p style="color: #718096; font-size: 12px; margin-top: 20px;">
            This is an automated email from FintekPro's commission verification system.
            Your reply will be used for audit and compliance purposes.
          </p>
        </div>
        <div style="background: #f7fafc; padding: 15px; text-align: center; font-size: 12px; color: #718096;">
          FintekPro Financial Services | support@fintekpro.com
        </div>
      </div>
    `;

    const ccEmails: string[] = [];
    if (lead.bankerEmail) ccEmails.push(lead.bankerEmail);

    const [emailRecord] = await db.insert(bankerConfirmationEmails).values({
      claimId,
      bankerEmail: lead.bankerEmail,
      seniorEmail: null,
      ccAdminEmail: "admin@fintekpro.com",
      emailSubject,
      emailBody,
    }).returning();

    const sent = await emailService.sendEmail({
      to: lead.bankerEmail,
      subject: emailSubject,
      html: emailBody,
    });

    await db.update(payoutClaims)
      .set({ bankerConfirmationEmailId: emailRecord.emailId })
      .where(eq(payoutClaims.claimId, claimId));

    await db.insert(leadAuditLogs).values({
      leadId: lead.leadId,
      claimId,
      actorId: "SYSTEM",
      actorRole: "system",
      action: "BANKER_CONFIRMATION_EMAIL_SENT",
      details: {
        emailId: emailRecord.emailId,
        bankerEmail: lead.bankerEmail,
        sent,
      },
    });

    console.log(`📧 Banker confirmation email ${sent ? 'sent' : 'simulated'} for claim ${claimId} to ${lead.bankerEmail}`);

    return { success: true, emailId: emailRecord.emailId };
  }
}

export const bankerConfirmationService = BankerConfirmationService.getInstance();
