import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

let whatsappClient: Client | null = null;

export class WhatsAppService {
  private client: Client;
  private isReady: boolean = false;

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code generated. Scan with your phone:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      console.log('WhatsApp Client is ready!');
      this.isReady = true;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Client authenticated');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp authentication failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp Client disconnected:', reason);
      this.isReady = false;
    });

    // Handle incoming messages
    this.client.on('message_create', async (message) => {
      if (message.fromMe) return; // Ignore messages sent by the bot
      
      await this.handleIncomingMessage(message);
    });
  }

  async initialize() {
    try {
      await this.client.initialize();
      whatsappClient = this.client;
    } catch (error) {
      console.error('Failed to initialize WhatsApp client:', error);
    }
  }

  private async handleIncomingMessage(message: Message) {
    const contact = await message.getContact();
    const chat = await message.getChat();
    
    console.log(`Message from ${contact.name || contact.number}: ${message.body}`);
    
    // Auto-respond with FinanceHub information
    if (message.body.toLowerCase().includes('portfolio') || 
        message.body.toLowerCase().includes('investment') ||
        message.body.toLowerCase().includes('finance')) {
      
      await message.reply(
        '🏦 *FinanceHub - Your Financial Partner*\n\n' +
        '📊 Portfolio Management\n' +
        '📈 Live Market Data\n' +
        '💰 Investment Tracking\n' +
        '🤖 AI-Powered Insights\n\n' +
        'Visit our platform to manage your investments and get personalized financial advice!'
      );
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      console.log('WhatsApp client not ready');
      return false;
    }

    try {
      const chatId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      await this.client.sendMessage(chatId, message);
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  async sendPortfolioUpdate(phoneNumber: string, portfolioData: any): Promise<boolean> {
    const message = this.formatPortfolioMessage(portfolioData);
    return await this.sendMessage(phoneNumber, message);
  }

  async sendMarketAlert(phoneNumber: string, alertData: any): Promise<boolean> {
    const message = this.formatMarketAlert(alertData);
    return await this.sendMessage(phoneNumber, message);
  }

  private formatPortfolioMessage(data: any): string {
    return `📊 *Portfolio Update*\n\n` +
           `💰 Total Value: ₹${data.totalValue?.toLocaleString() || 'N/A'}\n` +
           `📈 Today's Change: ${data.change > 0 ? '+' : ''}₹${data.change?.toLocaleString() || 'N/A'}\n` +
           `📊 Performance: ${data.performance > 0 ? '+' : ''}${data.performance?.toFixed(2) || 'N/A'}%\n\n` +
           `Visit FinanceHub for detailed analysis!`;
  }

  private formatMarketAlert(data: any): string {
    return `🚨 *Market Alert*\n\n` +
           `📈 ${data.symbol}: ₹${data.price}\n` +
           `${data.change > 0 ? '📈' : '📉'} ${data.change > 0 ? '+' : ''}${data.change}%\n\n` +
           `${data.message || 'Check FinanceHub for more details!'}`;
  }

  isClientReady(): boolean {
    return this.isReady;
  }

  async getChats() {
    if (!this.isReady) return [];
    return await this.client.getChats();
  }

  async logout() {
    if (this.client) {
      await this.client.logout();
      this.isReady = false;
    }
  }
}

export const whatsappService = new WhatsAppService();