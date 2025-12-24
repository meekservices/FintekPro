import { ZohoApiClient } from '../api-client';
import { db } from '../../db';
import { zohoConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ZohoBooksOrganization {
  organization_id: string;
  name: string;
  is_default_org: boolean;
  account_created_date: string;
  time_zone: string;
  language_code: string;
  date_format: string;
  currency_id: string;
  currency_code: string;
  currency_symbol: string;
  fiscal_year_start_month: number;
}

interface ZohoBooksInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  status: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code: string;
  created_time: string;
  last_modified_time: string;
}

interface ZohoBooksBill {
  bill_id: string;
  bill_number: string;
  vendor_id: string;
  vendor_name: string;
  status: string;
  date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code: string;
  created_time: string;
  last_modified_time: string;
}

interface ZohoBooksContact {
  contact_id: string;
  contact_name: string;
  company_name: string;
  contact_type: 'customer' | 'vendor';
  status: string;
  email: string;
  phone: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  created_time: string;
  last_modified_time: string;
}

interface ZohoBooksChartOfAccount {
  account_id: string;
  account_name: string;
  account_code: string;
  account_type: string;
  is_active: boolean;
  current_balance: number;
  parent_account_id?: string;
}

interface ZohoBooksPayment {
  payment_id: string;
  payment_number: string;
  payment_mode: string;
  amount: number;
  date: string;
  reference_number: string;
  customer_id?: string;
  customer_name?: string;
  vendor_id?: string;
  vendor_name?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  hasMorePage: boolean;
  totalRecords: number;
}

export class ZohoBooksService {
  private client: ZohoApiClient;
  private organizationId: string;

  constructor(connectionId: string, organizationId: string, dataCenter: string = 'in') {
    this.client = new ZohoApiClient(connectionId, 'Books', dataCenter);
    this.organizationId = organizationId;
  }

  private getOrgParam() {
    return { organization_id: this.organizationId };
  }

  // ==================== Organizations ====================

  async getOrganizations(): Promise<ZohoBooksOrganization[]> {
    const response = await this.client.get('/organizations');
    return response.data?.organizations || [];
  }

  async getOrganization(): Promise<ZohoBooksOrganization | null> {
    const response = await this.client.get(`/organizations/${this.organizationId}`);
    return response.data?.organization || null;
  }

  // ==================== Invoices ====================

  async getInvoices(params?: {
    page?: number;
    per_page?: number;
    status?: 'draft' | 'sent' | 'overdue' | 'paid' | 'void' | 'unpaid' | 'partially_paid';
    customer_id?: string;
    date_start?: string;
    date_end?: string;
    sort_column?: string;
    sort_order?: 'ascending' | 'descending';
  }): Promise<PaginatedResponse<ZohoBooksInvoice>> {
    const response = await this.client.get('/invoices', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      status: params?.status,
      customer_id: params?.customer_id,
      date_start: params?.date_start,
      date_end: params?.date_end,
      sort_column: params?.sort_column || 'created_time',
      sort_order: params?.sort_order || 'descending'
    });

    return {
      items: response.data?.invoices || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  async getInvoice(invoiceId: string): Promise<ZohoBooksInvoice | null> {
    const response = await this.client.get(`/invoices/${invoiceId}`, this.getOrgParam());
    return response.data?.invoice || null;
  }

  async getInvoicePdf(invoiceId: string): Promise<Buffer> {
    const response = await this.client.get(`/invoices/${invoiceId}`, {
      ...this.getOrgParam(),
      accept: 'pdf'
    });
    return response.data;
  }

  // ==================== Bills ====================

  async getBills(params?: {
    page?: number;
    per_page?: number;
    status?: 'draft' | 'open' | 'overdue' | 'paid' | 'void' | 'partially_paid';
    vendor_id?: string;
    date_start?: string;
    date_end?: string;
    sort_column?: string;
    sort_order?: 'ascending' | 'descending';
  }): Promise<PaginatedResponse<ZohoBooksBill>> {
    const response = await this.client.get('/bills', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      status: params?.status,
      vendor_id: params?.vendor_id,
      date_start: params?.date_start,
      date_end: params?.date_end,
      sort_column: params?.sort_column || 'created_time',
      sort_order: params?.sort_order || 'descending'
    });

    return {
      items: response.data?.bills || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  async getBill(billId: string): Promise<ZohoBooksBill | null> {
    const response = await this.client.get(`/bills/${billId}`, this.getOrgParam());
    return response.data?.bill || null;
  }

  // ==================== Contacts (Customers & Vendors) ====================

  async getContacts(params?: {
    page?: number;
    per_page?: number;
    contact_type?: 'customer' | 'vendor';
    status?: 'active' | 'inactive' | 'all';
    sort_column?: string;
    sort_order?: 'ascending' | 'descending';
  }): Promise<PaginatedResponse<ZohoBooksContact>> {
    const response = await this.client.get('/contacts', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      contact_type: params?.contact_type,
      status: params?.status || 'active',
      sort_column: params?.sort_column || 'created_time',
      sort_order: params?.sort_order || 'descending'
    });

    return {
      items: response.data?.contacts || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  async getContact(contactId: string): Promise<ZohoBooksContact | null> {
    const response = await this.client.get(`/contacts/${contactId}`, this.getOrgParam());
    return response.data?.contact || null;
  }

  // ==================== Chart of Accounts ====================

  async getChartOfAccounts(params?: {
    account_type?: string;
    filter_by?: 'Active' | 'Inactive' | 'All';
    sort_column?: string;
  }): Promise<ZohoBooksChartOfAccount[]> {
    const response = await this.client.get('/chartofaccounts', {
      ...this.getOrgParam(),
      account_type: params?.account_type,
      filter_by: params?.filter_by || 'Active',
      sort_column: params?.sort_column || 'account_name'
    });

    return response.data?.chartofaccounts || [];
  }

  // ==================== Payments Received ====================

  async getPaymentsReceived(params?: {
    page?: number;
    per_page?: number;
    customer_id?: string;
    date_start?: string;
    date_end?: string;
  }): Promise<PaginatedResponse<ZohoBooksPayment>> {
    const response = await this.client.get('/customerpayments', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      customer_id: params?.customer_id,
      date_start: params?.date_start,
      date_end: params?.date_end
    });

    return {
      items: response.data?.customerpayments || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  // ==================== Payments Made (to vendors) ====================

  async getPaymentsMade(params?: {
    page?: number;
    per_page?: number;
    vendor_id?: string;
    date_start?: string;
    date_end?: string;
  }): Promise<PaginatedResponse<ZohoBooksPayment>> {
    const response = await this.client.get('/vendorpayments', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      vendor_id: params?.vendor_id,
      date_start: params?.date_start,
      date_end: params?.date_end
    });

    return {
      items: response.data?.vendorpayments || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  // ==================== Bank Transactions ====================

  async getBankTransactions(accountId: string, params?: {
    page?: number;
    per_page?: number;
    transaction_type?: 'all' | 'uncategorized' | 'manually_added' | 'categorized';
    date_start?: string;
    date_end?: string;
  }): Promise<PaginatedResponse<any>> {
    const response = await this.client.get(`/bankaccounts/${accountId}/transactions`, {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      transaction_type: params?.transaction_type,
      date_start: params?.date_start,
      date_end: params?.date_end
    });

    return {
      items: response.data?.banktransactions || [],
      page: response.data?.page_context?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  async getBankAccounts(): Promise<any[]> {
    const response = await this.client.get('/bankaccounts', this.getOrgParam());
    return response.data?.bankaccounts || [];
  }

  // ==================== Reports ====================

  async getBalanceSheet(params?: { date?: string }): Promise<any> {
    const response = await this.client.get('/reports/balancesheet', {
      ...this.getOrgParam(),
      as_of_date: params?.date
    });
    return response.data;
  }

  async getProfitAndLoss(params?: { start_date?: string; end_date?: string }): Promise<any> {
    const response = await this.client.get('/reports/profitandloss', {
      ...this.getOrgParam(),
      from_date: params?.start_date,
      to_date: params?.end_date
    });
    return response.data;
  }

  async getCashFlow(params?: { start_date?: string; end_date?: string }): Promise<any> {
    const response = await this.client.get('/reports/cashflowstatement', {
      ...this.getOrgParam(),
      from_date: params?.start_date,
      to_date: params?.end_date
    });
    return response.data;
  }

  async getAgingReport(reportType: 'receivables' | 'payables', params?: {
    as_of_date?: string;
  }): Promise<any> {
    const endpoint = reportType === 'receivables' ? '/reports/agedreceivables' : '/reports/agedpayables';
    const response = await this.client.get(endpoint, {
      ...this.getOrgParam(),
      as_of_date: params?.as_of_date
    });
    return response.data;
  }

  // ==================== Dashboard Summary ====================

  async getDashboardSummary(): Promise<{
    totalReceivables: number;
    totalPayables: number;
    overdueReceivables: number;
    overduePayables: number;
    totalInvoices: number;
    totalBills: number;
    totalCustomers: number;
    totalVendors: number;
  }> {
    try {
      const [invoices, bills, customers, vendors] = await Promise.all([
        this.getInvoices({ page: 1, per_page: 1 }),
        this.getBills({ page: 1, per_page: 1 }),
        this.getContacts({ page: 1, per_page: 1, contact_type: 'customer' }),
        this.getContacts({ page: 1, per_page: 1, contact_type: 'vendor' })
      ]);

      const [unpaidInvoices, overdueBills] = await Promise.all([
        this.getInvoices({ status: 'unpaid', page: 1, per_page: 200 }),
        this.getBills({ status: 'overdue', page: 1, per_page: 200 })
      ]);

      const totalReceivables = unpaidInvoices.items.reduce((sum, inv) => sum + (inv.balance || 0), 0);
      const overdueReceivables = unpaidInvoices.items
        .filter(inv => inv.status === 'overdue')
        .reduce((sum, inv) => sum + (inv.balance || 0), 0);

      const totalPayables = overdueBills.items.reduce((sum, bill) => sum + (bill.balance || 0), 0);
      const overduePayables = overdueBills.items.reduce((sum, bill) => sum + (bill.balance || 0), 0);

      return {
        totalReceivables,
        totalPayables,
        overdueReceivables,
        overduePayables,
        totalInvoices: invoices.totalRecords,
        totalBills: bills.totalRecords,
        totalCustomers: customers.totalRecords,
        totalVendors: vendors.totalRecords
      };
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      throw error;
    }
  }
}

// Factory function to get Books service from active connection
export async function getZohoBooksService(dataCenter: string = 'in'): Promise<ZohoBooksService | null> {
  try {
    // Find active Zoho connection with Books service
    const [connection] = await db
      .select()
      .from(zohoConnections)
      .where(
        and(
          eq(zohoConnections.status, 'active')
        )
      )
      .limit(1);

    if (!connection) {
      console.warn('No active Zoho Books connection found');
      return null;
    }

    // Get organization ID from environment or connection metadata
    const organizationId = process.env.ZOHO_ZSOID || '';
    
    if (!organizationId) {
      console.warn('ZOHO_ZSOID not configured');
      return null;
    }

    return new ZohoBooksService(connection.id, organizationId, dataCenter);
  } catch (error) {
    console.error('Error initializing Zoho Books service:', error);
    return null;
  }
}

console.log('✅ Zoho Books Service initialized');
