import { logger } from '../../../logger';

export class AlpacaWebhookHandler {
  
  async handleEvent(payload: any) {
    const eventType = payload.event;
    
    logger.info(`[AlpacaWebhook] Received event: ${eventType}`, { payload });

    switch (eventType) {
      case 'trade_updates':
        await this.handleTradeUpdate(payload.data);
        break;
      case 'account_updates':
        await this.handleAccountUpdate(payload.data);
        break;
      case 'journal_status':
        await this.handleJournalUpdate(payload.data);
        break;
      default:
        logger.warn(`[AlpacaWebhook] Unhandled event type: ${eventType}`);
    }
  }

  private async handleTradeUpdate(data: any) {
    // Logic to update `alpaca_orders` table and potentially trigger portfolio refresh
    logger.info(`[AlpacaWebhook] Trade Update for order ${data.order?.id} - Status: ${data.event}`);
    // TODO: Update DB order status
  }

  private async handleAccountUpdate(data: any) {
    // Update local account cache / DB status
    logger.info(`[AlpacaWebhook] Account Update for ${data.account_id} - Status: ${data.status}`);
  }

  private async handleJournalUpdate(data: any) {
    // Funding / transfer updates
    logger.info(`[AlpacaWebhook] Journal Update ${data.id} - Status: ${data.status}`);
  }
}

export const alpacaWebhookHandler = new AlpacaWebhookHandler();
