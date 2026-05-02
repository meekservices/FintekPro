import { IBroker } from '../interfaces/IBroker';
import { logger } from '../../../logger';

export class IIFLAdapter implements IBroker {
  public readonly brokerId = 'IIFL';

  async createAccount(user: any): Promise<any> {
    logger.info(`[IIFLAdapter] Mock createAccount for user ${user.id}`);
    return { status: 'PENDING_KYC', providerId: 'IIFL_MOCK_123' };
  }

  async getPositions(accountId: string): Promise<any[]> {
    logger.info(`[IIFLAdapter] Mock getPositions for account ${accountId}`);
    return []; // Return mock positions matching canonical interface
  }

  async placeOrder(order: any): Promise<any> {
    logger.info(`[IIFLAdapter] Mock placeOrder`, order);
    return { orderId: 'IIFL_ORDER_123', status: 'QUEUED' };
  }
}

export const iiflAdapter = new IIFLAdapter();
