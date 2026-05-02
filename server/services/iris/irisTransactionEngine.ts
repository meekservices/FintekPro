import { irisClient } from './irisClient';
import { logger } from '../../logger';

export class IrisTransactionEngine {
  
  /**
   * Executes a normalized order payload on IRIS
   */
  async executeOrder(orderData: any) {
    try {
      logger.info(`[IrisTransactionEngine] Executing order`, { type: orderData.productType, pan: orderData.pan });
      
      let irisResponse;
      switch (orderData.productType) {
        case 'MUTUAL_FUND':
          irisResponse = await irisClient.placeOrder({
            pan: orderData.pan,
            schemeCode: orderData.providerId,
            amount: orderData.amount,
            folioNo: orderData.folioNo,
            paymentMode: orderData.paymentMode || 'NET_BANKING',
          });
          break;
        case 'FIXED_DEPOSIT':
          // IRIS requires different payload for FD
          irisResponse = await irisClient.call('/user/fixed-deposit/order', 'POST', {
            pan: orderData.pan,
            productId: orderData.providerId,
            amount: orderData.amount,
            tenureMonths: orderData.tenureMonths,
            paymentMode: orderData.paymentMode || 'NET_BANKING',
          });
          break;
        default:
          throw new Error(`Unsupported product type for IRIS execution: ${orderData.productType}`);
      }
      
      return {
        success: true,
        orderId: irisResponse.orderId || irisResponse.txnId,
        paymentUrl: irisResponse.paymentUrl,
        rawResponse: irisResponse
      };
      
    } catch (error: any) {
      logger.error(`[IrisTransactionEngine] Order execution failed`, { error: error.message });
      throw new Error(`IRIS execution failed: ${error.message}`);
    }
  }

  async checkOrderStatus(orderId: string) {
    try {
      const status = await irisClient.getOrderStatus(orderId);
      return {
        success: true,
        status: status.orderStatus || status.status,
        rawResponse: status
      };
    } catch (error: any) {
      logger.error(`[IrisTransactionEngine] Status check failed`, { orderId, error: error.message });
      throw new Error(`Status check failed: ${error.message}`);
    }
  }
}

export const irisTransactionEngine = new IrisTransactionEngine();
