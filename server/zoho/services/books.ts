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
      sort_order: params?.sort_order === 'ascending' ? 'A' : 'D'
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

  async createInvoice(data: {
    customer_id?: string;
    customer_name?: string;
    reference_number?: string;
    date: string;
    due_date?: string;
    line_items: Array<{
      item_id?: string; // Zoho inventory item ID (enables auto COGS/inventory adjustment)
      name: string;
      description?: string;
      rate: number;
      quantity: number;
      tax_id?: string;
    }>;
    notes?: string;
    terms?: string;
    discount?: number;
    discount_type?: 'entity_level' | 'item_level';
  }): Promise<ZohoBooksInvoice> {
    const response = await this.client.post('/invoices', {
      ...this.getOrgParam(),
      ...data
    });
    return response.data?.invoice;
  }

  async sendInvoice(invoiceId: string, emailOptions?: {
    to_mail_ids?: string[];
    cc_mail_ids?: string[];
    subject?: string;
    body?: string;
  }): Promise<boolean> {
    const response = await this.client.post(`/invoices/${invoiceId}/email`, {
      ...this.getOrgParam(),
      ...emailOptions
    });
    return response.data?.code === 0;
  }

  async recordInvoicePayment(invoiceId: string, data: {
    amount: number;
    date: string;
    payment_mode?: string;
    reference_number?: string;
    description?: string;
    bank_charges?: number;
    account_id?: string;
  }): Promise<any> {
    const response = await this.client.post(`/invoices/${invoiceId}/payments`, {
      ...this.getOrgParam(),
      ...data
    });
    return response.data?.payment;
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
      sort_order: params?.sort_order === 'ascending' ? 'A' : 'D'
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

  async createBill(data: {
    vendor_id?: string;
    vendor_name?: string;
    reference_number?: string;
    date: string;
    due_date?: string;
    line_items: Array<{
      name: string;
      description?: string;
      rate: number;
      quantity: number;
      account_id?: string;
      tax_id?: string;
    }>;
    notes?: string;
  }): Promise<ZohoBooksBill> {
    const response = await this.client.post('/bills', {
      ...this.getOrgParam(),
      ...data
    });
    return response.data?.bill;
  }

  async recordBillPayment(billId: string, data: {
    amount: number;
    date: string;
    payment_mode?: string;
    reference_number?: string;
    description?: string;
    account_id?: string;
  }): Promise<any> {
    const response = await this.client.post(`/bills/${billId}/payments`, {
      ...this.getOrgParam(),
      ...data
    });
    return response.data?.payment;
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
      sort_order: params?.sort_order === 'ascending' ? 'A' : 'D'
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

  async createContact(data: {
    contact_name: string;
    company_name?: string;
    contact_type: 'customer' | 'vendor';
    email?: string;
    phone?: string;
    billing_address?: {
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    gst_no?: string;
    pan_no?: string;
    notes?: string;
  }): Promise<ZohoBooksContact> {
    const response = await this.client.post('/contacts', {
      ...this.getOrgParam(),
      ...data
    });
    return response.data?.contact;
  }

  async findOrCreateContact(params: {
    contact_name: string;
    contact_type: 'customer' | 'vendor';
    email?: string;
    phone?: string;
  }): Promise<ZohoBooksContact> {
    const contacts = await this.getContacts({
      contact_type: params.contact_type,
      status: 'active'
    });

    const existing = contacts.items.find(
      c => c.contact_name.toLowerCase() === params.contact_name.toLowerCase() ||
           (params.email && c.email?.toLowerCase() === params.email?.toLowerCase())
    );

    if (existing) {
      return existing;
    }

    return this.createContact({
      contact_name: params.contact_name,
      contact_type: params.contact_type,
      email: params.email,
      phone: params.phone
    });
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

  // ==================== Items (Inventory) ====================

  async createItem(params: {
    name: string;
    description?: string;
    rate: number;
    sku?: string;
    unit?: string;
    item_type?: 'sales' | 'purchases' | 'sales_and_purchases' | 'inventory';
    product_type?: 'goods' | 'service';
    initial_stock?: number;
    initial_stock_rate?: number;
    purchase_rate?: number;
    account_id?: string;
    inventory_account_id?: string;
    purchase_account_id?: string;
  }): Promise<{ item_id: string; name: string; sku: string }> {
    const response = await this.client.post('/items', {
      ...this.getOrgParam(),
      ...params,
      item_type: params.item_type || 'inventory',
      product_type: params.product_type || 'goods'
    });
    
    return {
      item_id: response.data?.item?.item_id || '',
      name: response.data?.item?.name || params.name,
      sku: response.data?.item?.sku || params.sku || ''
    };
  }

  async getItem(itemId: string): Promise<any> {
    const response = await this.client.get(`/items/${itemId}`, this.getOrgParam());
    return response.data?.item || null;
  }

  async adjustInventory(params: {
    item_id: string;
    adjustment_type: 'quantity' | 'value';
    quantity_adjusted?: number;
    value_adjusted?: number;
    reason?: string;
    description?: string;
    date?: string;
  }): Promise<{ inventory_adjustment_id: string }> {
    const response = await this.client.post('/inventoryadjustments', {
      ...this.getOrgParam(),
      line_items: [{
        item_id: params.item_id,
        quantity_adjusted: params.quantity_adjusted,
        value_adjusted: params.value_adjusted
      }],
      adjustment_type: params.adjustment_type,
      reason: params.reason || 'Sale from inventory',
      description: params.description,
      date: params.date || new Date().toISOString().split('T')[0]
    });
    
    return {
      inventory_adjustment_id: response.data?.inventory_adjustment?.inventory_adjustment_id || ''
    };
  }

  // ==================== Expenses (COGS) ====================

  async createExpense(params: {
    account_id: string;
    amount: number;
    date?: string;
    reference_number?: string;
    description?: string;
    vendor_id?: string;
    is_billable?: boolean;
  }): Promise<{ expense_id: string }> {
    const response = await this.client.post('/expenses', {
      ...this.getOrgParam(),
      account_id: params.account_id,
      amount: params.amount,
      date: params.date || new Date().toISOString().split('T')[0],
      reference_number: params.reference_number,
      description: params.description,
      vendor_id: params.vendor_id,
      is_billable: params.is_billable || false
    });
    
    return {
      expense_id: response.data?.expense?.expense_id || ''
    };
  }

  async getExpenses(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    account_id?: string;
    date_start?: string;
    date_end?: string;
  }): Promise<PaginatedResponse<any>> {
    const response = await this.client.get('/expenses', {
      ...this.getOrgParam(),
      page: params?.page || 1,
      per_page: params?.per_page || 25,
      status: params?.status,
      account_id: params?.account_id,
      date_start: params?.date_start,
      date_end: params?.date_end
    });
    
    return {
      items: response.data?.expenses || [],
      page: params?.page || 1,
      hasMorePage: response.data?.page_context?.has_more_page || false,
      totalRecords: response.data?.page_context?.total || 0
    };
  }

  // Get or create COGS account for bond inventory sales
  async getOrCreateCOGSAccount(): Promise<{ account_id: string; account_name: string }> {
    // Try to find existing COGS account
    const accounts = await this.getChartOfAccounts();
    const cogsAccount = accounts.find(
      acc => acc.account_name.toLowerCase().includes('cost of goods') || 
             acc.account_type === 'cost_of_goods_sold'
    );
    
    if (cogsAccount) {
      return { account_id: cogsAccount.account_id, account_name: cogsAccount.account_name };
    }
    
    // Create if not exists
    const response = await this.client.post('/chartofaccounts', {
      ...this.getOrgParam(),
      account_name: 'Cost of Goods Sold - Bond Inventory',
      account_type: 'cost_of_goods_sold',
      description: 'Cost of bonds sold from FintekPro inventory'
    });
    
    return {
      account_id: response.data?.account?.account_id || '',
      account_name: response.data?.account?.account_name || 'Cost of Goods Sold - Bond Inventory'
    };
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

    // Get organization ID - Books uses its own org ID, fallback to ZSOID
    const organizationId = process.env.ZOHO_BOOKS_ORGANIZATION_ID || process.env.ZOHO_ZSOID || '';
    
    if (!organizationId) {
      console.warn('ZOHO_BOOKS_ORGANIZATION_ID or ZOHO_ZSOID not configured');
      return null;
    }

    return new ZohoBooksService(connection.id, organizationId, dataCenter);
  } catch (error) {
    console.error('Error initializing Zoho Books service:', error);
    return null;
  }
}

console.log('✅ Zoho Books Service initialized');
