import twilio from 'twilio';

class SMSService {
  private client: any;
  private fromNumber: string = '';
  private messagingServiceSid: string = '';
  private isConfigured: boolean;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (accountSid && authToken && (messagingServiceSid || fromNumber)) {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = fromNumber || '';
      this.messagingServiceSid = messagingServiceSid || '';
      this.isConfigured = true;
      console.log('✅ Twilio SMS service initialized');
      if (this.messagingServiceSid) {
        console.log(`   Using Messaging Service: ${this.messagingServiceSid.substring(0, 10)}...`);
      }
    } else {
      this.isConfigured = false;
      console.log('⚠️  Twilio SMS service not configured - missing credentials');
    }
  }

  async sendOTP(mobile: string, otp: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📱 SMS OTP for ${mobile}: ${otp} (Twilio not configured)`);
      return false;
    }

    try {
      // Ensure mobile number is in E.164 format
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

      const messageOptions: any = {
        body: `Your FintekPro login OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        to: formattedMobile,
      };

      // Prefer Messaging Service SID for better delivery
      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else {
        messageOptions.from = this.fromNumber;
      }

      const message = await this.client.messages.create(messageOptions);

      console.log(`✅ SMS OTP sent to ${formattedMobile} - SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send SMS OTP:', error);
      return false;
    }
  }

  async sendPasswordResetOTP(mobile: string, otp: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📱 Password Reset OTP for ${mobile}: ${otp} (Twilio not configured)`);
      return false;
    }

    try {
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

      const messageOptions: any = {
        body: `Your FintekPro password reset OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        to: formattedMobile,
      };

      // Prefer Messaging Service SID for better delivery
      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else {
        messageOptions.from = this.fromNumber;
      }

      const message = await this.client.messages.create(messageOptions);

      console.log(`✅ Password reset SMS sent to ${formattedMobile} - SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send password reset SMS:', error);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

export const smsService = new SMSService();
