import { db } from '../../db';
import { 
  zohoWebhookEvents, zohoEntityMappings, zohoSyncLogs,
  prospectClients, partnerCommissions, users, partners
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { ZohoApiClient } from '../api-client';

const CONNECTION_ID = '1762VW9pAGQpLby6IdcmI';
const DATA_CENTER = 'in';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

interface ProcessingResult {
  eventId: string;
  success: boolean;
  action: string;
  error?: string;
}

export class ZohoWebhookProcessor {
  private connectionId: string;

  constructor(connectionId: string = CONNECTION_ID) {
    this.connectionId = connectionId;
  }

  async processPendingEvents(limit: number = 50): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    results: ProcessingResult[];
  }> {
    if (!isProduction()) {
      console.log('[WebhookProcessor] Skipped - bidirectional sync only runs in production');
      return { processed: 0, succeeded: 0, failed: 0, results: [] };
    }

    const pendingEvents = await db
      .select()
      .from(zohoWebhookEvents)
      .where(
        sql`${zohoWebhookEvents.status} IN ('received', 'pending') AND (${zohoWebhookEvents.retryCount} < 3 OR ${zohoWebhookEvents.retryCount} IS NULL)`
      )
      .orderBy(zohoWebhookEvents.createdAt)
      .limit(limit);

    const results: ProcessingResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      await db
        .update(zohoWebhookEvents)
        .set({ status: 'processing' })
        .where(eq(zohoWebhookEvents.id, event.id));

      try {
        const result = await this.processEvent(event);
        results.push(result);

        await db
          .update(zohoWebhookEvents)
          .set({
            status: result.success ? 'completed' : 'failed',
            processedAt: new Date(),
            processingError: result.error || null,
            updatedAt: new Date()
          })
          .where(eq(zohoWebhookEvents.id, event.id));

        if (result.success) succeeded++;
        else failed++;
      } catch (error: any) {
        failed++;
        const retryCount = (event.retryCount || 0) + 1;
        const nextRetry = new Date(Date.now() + Math.pow(2, retryCount) * 60000);

        await db
          .update(zohoWebhookEvents)
          .set({
            status: retryCount >= 3 ? 'failed' : 'pending',
            processingError: error.message,
            retryCount,
            nextRetryAt: retryCount < 3 ? nextRetry : null,
            updatedAt: new Date()
          })
          .where(eq(zohoWebhookEvents.id, event.id));

        results.push({
          eventId: event.id,
          success: false,
          action: 'error',
          error: error.message
        });
      }
    }

    return { processed: pendingEvents.length, succeeded, failed, results };
  }

  private async processEvent(event: any): Promise<ProcessingResult> {
    const service = event.zohoService;
    const module = event.zohoModule;
    const eventType = event.eventType;
    const payload = event.webhookPayload as any;

    switch (service) {
      case 'CRM':
        return this.processCRMEvent(event, payload);
      case 'Books':
        return this.processBooksEvent(event, payload);
      case 'Sign':
        return this.processSignEvent(event, payload);
      case 'Meeting':
        return this.processMeetingEvent(event, payload);
      default:
        return {
          eventId: event.id,
          success: true,
          action: `skipped_unknown_service_${service}`
        };
    }
  }

  private async processCRMEvent(event: any, payload: any): Promise<ProcessingResult> {
    const module = (payload.module || event.zohoModule || '').toLowerCase();
    const eventType = (payload.event_type || event.eventType || '').toLowerCase();
    const recordId = payload.id || payload.record_id || event.zohoRecordId;

    if (!recordId) {
      return { eventId: event.id, success: true, action: 'skipped_no_record_id' };
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoRecordId, recordId)
        )
      )
      .limit(1);

    if (module === 'contacts' || module === 'contact') {
      return this.processCRMContactEvent(event, payload, recordId, existingMapping, eventType);
    } else if (module === 'leads' || module === 'lead') {
      return this.processCRMLeadEvent(event, payload, recordId, existingMapping, eventType);
    } else if (module === 'deals' || module === 'deal') {
      return this.processCRMDealEvent(event, payload, recordId, existingMapping, eventType);
    }

    return { eventId: event.id, success: true, action: `skipped_crm_module_${module}` };
  }

  private async processCRMContactEvent(
    event: any, payload: any, recordId: string, existingMapping: any, eventType: string
  ): Promise<ProcessingResult> {
    if (!existingMapping) {
      if (eventType.includes('create')) {
        const contactData = await this.fetchCRMRecord('Contacts', recordId);
        if (!contactData) {
          return { eventId: event.id, success: false, action: 'fetch_failed', error: 'Could not fetch contact from Zoho' };
        }

        const email = contactData.Email?.toLowerCase().trim();
        const mobile = contactData.Mobile || contactData.Phone;
        const name = [contactData.First_Name, contactData.Last_Name].filter(Boolean).join(' ').trim() || 'Unknown';

        if (!email && !mobile) {
          return { eventId: event.id, success: true, action: 'skipped_no_contact_info' };
        }

        const existingConditions = [];
        if (email) existingConditions.push(eq(prospectClients.email, email));
        if (mobile) existingConditions.push(eq(prospectClients.mobile, mobile));

        const [existing] = existingConditions.length > 0 
          ? await db.select({ id: prospectClients.id }).from(prospectClients).where(sql`${existingConditions[0]}`).limit(1)
          : [];

        if (existing) {
          await db.insert(zohoEntityMappings).values({
            connectionId: this.connectionId,
            fintekproEntityType: 'prospect',
            fintekproEntityId: existing.id,
            zohoService: 'CRM',
            zohoModule: 'Contacts',
            zohoRecordId: recordId,
            zohoRecordData: contactData,
            syncDirection: 'from_zoho',
            lastSyncedAt: new Date(),
            syncStatus: 'synced'
          });
          return { eventId: event.id, success: true, action: 'mapped_existing_prospect' };
        }

        return { eventId: event.id, success: true, action: 'new_contact_logged' };
      }
      return { eventId: event.id, success: true, action: 'skipped_unmapped_contact' };
    }

    if (eventType.includes('update')) {
      const contactData = await this.fetchCRMRecord('Contacts', recordId);
      if (!contactData) {
        return { eventId: event.id, success: false, action: 'fetch_failed', error: 'Could not fetch updated contact' };
      }

      const fintekproType = existingMapping.fintekproEntityType;
      const fintekproId = existingMapping.fintekproEntityId;

      if (fintekproType === 'prospect') {
        const updateData: any = {};
        if (contactData.Email) updateData.email = contactData.Email.toLowerCase().trim();
        if (contactData.Mobile || contactData.Phone) updateData.mobile = contactData.Mobile || contactData.Phone;
        const name = [contactData.First_Name, contactData.Last_Name].filter(Boolean).join(' ').trim();
        if (name) updateData.name = name;
        updateData.updatedAt = new Date();

        if (Object.keys(updateData).length > 1) {
          await db.update(prospectClients).set(updateData).where(eq(prospectClients.id, fintekproId));
        }
      } else if (fintekproType === 'user') {
        const updateData: any = {};
        if (contactData.Email) updateData.email = contactData.Email.toLowerCase().trim();
        if (contactData.Mobile || contactData.Phone) updateData.phone = contactData.Mobile || contactData.Phone;
        const fullName = [contactData.First_Name, contactData.Last_Name].filter(Boolean).join(' ').trim();
        if (fullName) updateData.fullName = fullName;

        if (Object.keys(updateData).length > 0) {
          await db.update(users).set(updateData).where(eq(users.id, fintekproId));
        }
      }

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: contactData,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      await this.logSync('update', fintekproType, 'from_zoho', 'CRM', 'Contacts', true);
      return { eventId: event.id, success: true, action: `updated_${fintekproType}` };
    }

    return { eventId: event.id, success: true, action: 'skipped_contact_event' };
  }

  private async processCRMLeadEvent(
    event: any, payload: any, recordId: string, existingMapping: any, eventType: string
  ): Promise<ProcessingResult> {
    if (!existingMapping) {
      return { eventId: event.id, success: true, action: 'skipped_unmapped_lead' };
    }

    if (eventType.includes('update')) {
      const leadData = await this.fetchCRMRecord('Leads', recordId);
      if (!leadData) {
        return { eventId: event.id, success: false, action: 'fetch_failed', error: 'Could not fetch updated lead' };
      }

      const fintekproType = existingMapping.fintekproEntityType;
      const fintekproId = existingMapping.fintekproEntityId;

      if (fintekproType === 'prospect') {
        const updateData: any = {};
        if (leadData.Email) updateData.email = leadData.Email.toLowerCase().trim();
        if (leadData.Mobile || leadData.Phone) updateData.mobile = leadData.Mobile || leadData.Phone;
        const name = [leadData.First_Name, leadData.Last_Name].filter(Boolean).join(' ').trim();
        if (name) updateData.name = name;
        updateData.updatedAt = new Date();

        if (Object.keys(updateData).length > 1) {
          await db.update(prospectClients).set(updateData).where(eq(prospectClients.id, fintekproId));
        }
      }

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: leadData,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      await this.logSync('update', fintekproType, 'from_zoho', 'CRM', 'Leads', true);
      return { eventId: event.id, success: true, action: `updated_${fintekproType}_from_lead` };
    }

    return { eventId: event.id, success: true, action: 'skipped_lead_event' };
  }

  private async processCRMDealEvent(
    event: any, payload: any, recordId: string, existingMapping: any, eventType: string
  ): Promise<ProcessingResult> {
    if (!existingMapping) {
      return { eventId: event.id, success: true, action: 'skipped_unmapped_deal' };
    }

    if (eventType.includes('update')) {
      const dealData = await this.fetchCRMRecord('Deals', recordId);
      if (!dealData) {
        return { eventId: event.id, success: false, action: 'fetch_failed', error: 'Could not fetch updated deal' };
      }

      if (existingMapping.fintekproEntityType === 'partner_commission') {
        const commissionId = existingMapping.fintekproEntityId;
        const zohoStage = dealData.Stage;
        const statusMap: Record<string, string> = {
          'Qualification': 'pending',
          'Needs Analysis': 'approved',
          'Value Proposition': 'processing',
          'Closed Won': 'completed',
          'Closed Lost': 'cancelled',
          'Negotiation/Review': 'on_hold'
        };

        const newStatus = statusMap[zohoStage];
        if (newStatus) {
          await db
            .update(partnerCommissions)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(partnerCommissions.id, commissionId));
        }

        if (dealData.Amount) {
          await db
            .update(partnerCommissions)
            .set({ commissionAmount: dealData.Amount.toString(), updatedAt: new Date() })
            .where(eq(partnerCommissions.id, commissionId));
        }
      }

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: dealData,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      await this.logSync('update', 'partner_commission', 'from_zoho', 'CRM', 'Deals', true);
      return { eventId: event.id, success: true, action: 'updated_commission_from_deal' };
    }

    return { eventId: event.id, success: true, action: 'skipped_deal_event' };
  }

  private async processBooksEvent(event: any, payload: any): Promise<ProcessingResult> {
    const eventType = (payload.event_type || event.eventType || '').toLowerCase();
    const module = (payload.module || event.zohoModule || '').toLowerCase();

    if (module.includes('invoice') || eventType.includes('invoice')) {
      return this.processBooksInvoiceEvent(event, payload, eventType);
    }

    if (module.includes('payment') || eventType.includes('payment')) {
      return this.processBooksPaymentEvent(event, payload, eventType);
    }

    return { eventId: event.id, success: true, action: `skipped_books_${module}` };
  }

  private async processBooksInvoiceEvent(event: any, payload: any, eventType: string): Promise<ProcessingResult> {
    const invoiceId = payload.invoice_id || payload.id;
    if (!invoiceId) {
      return { eventId: event.id, success: true, action: 'skipped_no_invoice_id' };
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, 'Books'),
          eq(zohoEntityMappings.zohoModule, 'Invoices'),
          eq(zohoEntityMappings.zohoRecordId, invoiceId)
        )
      )
      .limit(1);

    if (existingMapping) {
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: payload,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));
    } else {
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'invoice',
        fintekproEntityId: invoiceId,
        zohoService: 'Books',
        zohoModule: 'Invoices',
        zohoRecordId: invoiceId,
        zohoRecordData: payload,
        syncDirection: 'from_zoho',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });
    }

    await this.logSync(eventType.includes('create') ? 'create' : 'update', 'invoice', 'from_zoho', 'Books', 'Invoices', true);
    return { eventId: event.id, success: true, action: `invoice_${eventType}` };
  }

  private async processBooksPaymentEvent(event: any, payload: any, eventType: string): Promise<ProcessingResult> {
    const paymentId = payload.payment_id || payload.id;
    if (!paymentId) {
      return { eventId: event.id, success: true, action: 'skipped_no_payment_id' };
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, 'Books'),
          eq(zohoEntityMappings.zohoModule, 'Payments'),
          eq(zohoEntityMappings.zohoRecordId, paymentId)
        )
      )
      .limit(1);

    if (existingMapping) {
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: payload,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));
    } else {
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'payment',
        fintekproEntityId: paymentId,
        zohoService: 'Books',
        zohoModule: 'Payments',
        zohoRecordId: paymentId,
        zohoRecordData: payload,
        syncDirection: 'from_zoho',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });
    }

    if (eventType.includes('paid') || eventType.includes('received')) {
      const invoiceId = payload.invoice_id || payload.reference_number;
      if (invoiceId) {
        const [invoiceMapping] = await db
          .select()
          .from(zohoEntityMappings)
          .where(
            and(
              eq(zohoEntityMappings.connectionId, this.connectionId),
              eq(zohoEntityMappings.zohoService, 'Books'),
              eq(zohoEntityMappings.zohoModule, 'Invoices'),
              eq(zohoEntityMappings.zohoRecordId, invoiceId)
            )
          )
          .limit(1);

        if (invoiceMapping) {
          const existingData = (invoiceMapping.zohoRecordData as any) || {};
          await db
            .update(zohoEntityMappings)
            .set({
              zohoRecordData: { ...existingData, payment_status: 'paid', payment_received_at: new Date().toISOString() },
              lastSyncedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(zohoEntityMappings.id, invoiceMapping.id));
        }
      }
    }

    await this.logSync(eventType.includes('create') ? 'create' : 'update', 'payment', 'from_zoho', 'Books', 'Payments', true);
    return { eventId: event.id, success: true, action: `payment_${eventType}` };
  }

  private async processSignEvent(event: any, payload: any): Promise<ProcessingResult> {
    const actionType = payload.action_type || payload.event_type || event.eventType || '';
    const requestId = payload.requests?.request_id || payload.request_id;

    if (!requestId) {
      return { eventId: event.id, success: true, action: 'skipped_no_request_id' };
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, 'Sign'),
          eq(zohoEntityMappings.zohoRecordId, requestId)
        )
      )
      .limit(1);

    const signStatus = actionType.includes('Completed') || actionType.includes('completed')
      ? 'completed'
      : actionType.includes('Declined') || actionType.includes('declined')
        ? 'declined'
        : actionType.includes('Viewed') || actionType.includes('viewed')
          ? 'viewed'
          : 'in_progress';

    if (existingMapping) {
      const existingData = (existingMapping.zohoRecordData as any) || {};
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: { ...existingData, sign_status: signStatus, last_action: actionType, updated_at: new Date().toISOString() },
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));
    } else {
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'sign_document',
        fintekproEntityId: requestId,
        zohoService: 'Sign',
        zohoModule: 'Documents',
        zohoRecordId: requestId,
        zohoRecordData: { sign_status: signStatus, payload },
        syncDirection: 'from_zoho',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });
    }

    await this.logSync('update', 'sign_document', 'from_zoho', 'Sign', 'Documents', true);
    return { eventId: event.id, success: true, action: `sign_${signStatus}` };
  }

  private async processMeetingEvent(event: any, payload: any): Promise<ProcessingResult> {
    const eventType = payload.event_type || event.eventType || '';
    const meetingKey = payload.meeting_key || payload.meetingKey;

    if (!meetingKey) {
      return { eventId: event.id, success: true, action: 'skipped_no_meeting_key' };
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, 'Meeting'),
          eq(zohoEntityMappings.zohoRecordId, meetingKey)
        )
      )
      .limit(1);

    const meetingStatus = eventType.includes('ended') ? 'ended'
      : eventType.includes('started') ? 'started'
        : eventType.includes('created') ? 'created'
          : eventType.includes('recording') ? 'recording_ready'
            : 'unknown';

    if (existingMapping) {
      const existingData = (existingMapping.zohoRecordData as any) || {};
      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: {
            ...existingData,
            meeting_status: meetingStatus,
            last_event: eventType,
            recording_url: payload.recording_url || existingData.recording_url
          },
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));
    } else {
      await db.insert(zohoEntityMappings).values({
        connectionId: this.connectionId,
        fintekproEntityType: 'meeting',
        fintekproEntityId: meetingKey,
        zohoService: 'Meeting',
        zohoModule: 'Meetings',
        zohoRecordId: meetingKey,
        zohoRecordData: { meeting_status: meetingStatus, payload },
        syncDirection: 'from_zoho',
        lastSyncedAt: new Date(),
        syncStatus: 'synced'
      });
    }

    await this.logSync('update', 'meeting', 'from_zoho', 'Meeting', 'Meetings', true);
    return { eventId: event.id, success: true, action: `meeting_${meetingStatus}` };
  }

  private async fetchCRMRecord(module: string, recordId: string): Promise<any | null> {
    try {
      const apiClient = new ZohoApiClient(this.connectionId, 'CRM', DATA_CENTER);
      const response = await apiClient.get(`/${module}/${recordId}`);
      return response.data?.data?.[0] || null;
    } catch (error: any) {
      console.error(`[WebhookProcessor] Failed to fetch ${module}/${recordId}:`, error.message);
      return null;
    }
  }

  private async logSync(
    operation: string, entityType: string, direction: string,
    zohoService: string, zohoModule: string, success: boolean
  ): Promise<void> {
    try {
      await db.insert(zohoSyncLogs).values({
        connectionId: this.connectionId,
        operation,
        entityType,
        direction,
        zohoService,
        zohoModule,
        status: success ? 'success' : 'failure',
        recordsProcessed: 1,
        recordsSucceeded: success ? 1 : 0,
        recordsFailed: success ? 0 : 1
      });
    } catch (e) {
      console.error('[WebhookProcessor] Failed to log sync:', e);
    }
  }

  async getProcessingStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalEvents: number;
  }> {
    const stats = await db
      .select({
        status: zohoWebhookEvents.status,
        count: sql<number>`count(*)`
      })
      .from(zohoWebhookEvents)
      .groupBy(zohoWebhookEvents.status);

    const statusCounts: Record<string, number> = {};
    stats.forEach(s => { statusCounts[s.status || 'unknown'] = Number(s.count); });

    return {
      pending: (statusCounts['pending'] || 0) + (statusCounts['received'] || 0),
      processing: statusCounts['processing'] || 0,
      completed: statusCounts['completed'] || 0,
      failed: statusCounts['failed'] || 0,
      totalEvents: Object.values(statusCounts).reduce((a, b) => a + b, 0)
    };
  }
}
