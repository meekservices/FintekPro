import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import type { Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { storage } from './storage';
import { randomUUID } from 'crypto';

let whatsappClient: InstanceType<typeof Client> | null = null;

interface AuthSession {
  id: string;
  phoneNumber: string;
  verificationCode: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
}

export class WhatsAppService {
  private client: InstanceType<typeof Client>;
  private isReady: boolean = false;
  private qrCode: string | null = null;
  private authSessions: Map<string, AuthSession> = new Map();

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
      }),
      puppeteer: {
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-extensions'
        ]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr: string) => {
      console.log('WhatsApp QR Code generated. Scan with your phone:');
      qrcode.generate(qr, { small: true });
      this.qrCode = qr;
    });

    this.client.on('ready', () => {
      console.log('WhatsApp Client is ready!');
      this.isReady = true;
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp Client authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('WhatsApp authentication failed:', msg);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('WhatsApp Client disconnected:', reason);
      this.isReady = false;
    });

    // Handle incoming messages
    this.client.on('message_create', async (message: Message) => {
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
    
    // Check for authentication verification codes
    const phoneNumber = contact.number;
    const messageText = message.body.trim();
    
    // Check if this is a verification code
    if (/^\d{6}$/.test(messageText)) {
      const session = Array.from(this.authSessions.values()).find(
        s => s.phoneNumber === phoneNumber && s.verificationCode === messageText && !s.verified
      );
      
      if (session && session.expiresAt > new Date()) {
        session.verified = true;
        await message.reply(
          '✅ *Authentication Successful!*\n\n' +
          'You have been successfully logged in to FintekPro.\n' +
          'You can now access your account through our platform.'
        );
        return;
      }
    }
    
    // Handle login requests
    if (messageText.toLowerCase().includes('login') || messageText.toLowerCase().includes('signin')) {
      await this.initiateClientLogin(phoneNumber, message);
      return;
    }
    
    // Auto-respond with FintekPro information
    if (message.body.toLowerCase().includes('portfolio') || 
        message.body.toLowerCase().includes('investment') ||
        message.body.toLowerCase().includes('finance')) {
      
      await message.reply(
        '🏦 *FintekPro - Your Financial Partner*\n\n' +
        '📊 Portfolio Management\n' +
        '📈 Live Market Data\n' +
        '💰 Investment Tracking\n' +
        '🤖 AI-Powered Insights\n\n' +
        'Send "login" to authenticate with your account!\n' +
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

  // Client Authentication Methods
  private async initiateClientLogin(phoneNumber: string, message: Message): Promise<void> {
    try {
      // Check if user exists by phone number
      const users = await storage.getAllUsers();
      const user = users.find(u => u.phoneNumber === phoneNumber);
      
      if (!user) {
        await message.reply(
          '❌ *Account Not Found*\n\n' +
          'No FintekPro account found for this phone number.\n' +
          'Please register on our platform first or contact support.'
        );
        return;
      }

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const authSession: AuthSession = {
        id: sessionId,
        phoneNumber,
        verificationCode,
        userId: user.id,
        createdAt: new Date(),
        expiresAt,
        verified: false
      };

      this.authSessions.set(sessionId, authSession);

      await message.reply(
        '🔐 *Login Verification*\n\n' +
        `Your verification code is: *${verificationCode}*\n\n` +
        'Please reply with this 6-digit code to complete your login.\n' +
        'Code expires in 10 minutes.'
      );

      console.log(`Login verification sent to ${phoneNumber}: ${verificationCode}`);
    } catch (error) {
      console.error('Failed to initiate client login:', error);
      await message.reply(
        '❌ *Login Error*\n\n' +
        'Unable to process your login request. Please try again later or contact support.'
      );
    }
  }

  async getQRCode(): Promise<string | null> {
    return this.qrCode;
  }

  async verifyAuthSession(sessionId: string): Promise<{ success: boolean; userId?: string }> {
    const session = this.authSessions.get(sessionId);
    
    if (!session) {
      return { success: false };
    }

    if (!session.verified || session.expiresAt < new Date()) {
      return { success: false };
    }

    return { success: true, userId: session.userId };
  }

  async getAuthSessionByPhone(phoneNumber: string): Promise<AuthSession | null> {
    const sessions = Array.from(this.authSessions.values());
    return sessions.find(s => s.phoneNumber === phoneNumber && s.verified && s.expiresAt > new Date()) || null;
  }

  async createAuthSession(phoneNumber: string): Promise<string> {
    // Generate verification code and session
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const authSession: AuthSession = {
      id: sessionId,
      phoneNumber,
      verificationCode,
      createdAt: new Date(),
      expiresAt,
      verified: false
    };

    this.authSessions.set(sessionId, authSession);

    // Send verification code via WhatsApp
    await this.sendMessage(
      phoneNumber,
      '🔐 *FintekPro Login Verification*\n\n' +
      `Your verification code is: *${verificationCode}*\n\n` +
      'Please enter this code on the login page to complete authentication.\n' +
      'Code expires in 10 minutes.'
    );

    return sessionId;
  }

  async verifyCode(sessionId: string, code: string): Promise<{ success: boolean; userId?: string }> {
    const session = this.authSessions.get(sessionId);
    
    if (!session) {
      return { success: false };
    }

    if (session.expiresAt < new Date()) {
      this.authSessions.delete(sessionId);
      return { success: false };
    }

    if (session.verificationCode !== code) {
      return { success: false };
    }

    session.verified = true;
    return { success: true, userId: session.userId };
  }

  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of Array.from(this.authSessions.entries())) {
      if (session.expiresAt < now) {
        this.authSessions.delete(sessionId);
      }
    }
  }
}

export const whatsappService = new WhatsAppService();