import { getTwilioClient, getTwilioFromPhoneNumber, isTwilioConfigured } from './twilio-client';

class SMSService {
  private messagingServiceSid: string = '';

  constructor() {
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
    console.log('📱 SMS service initialized (using Replit Twilio connector)');
    if (this.messagingServiceSid) {
      console.log(`   Messaging Service SID: ${this.messagingServiceSid.substring(0, 10)}...`);
    }
  }

  async sendOTP(mobile: string, otp: string): Promise<boolean> {
    try {
      const isConfigured = await isTwilioConfigured();
      if (!isConfigured) {
        console.log(`📱 SMS OTP for ${mobile}: ${otp} (Twilio not configured)`);
        return false;
      }

      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

      const messageOptions: any = {
        body: `Your FintekPro login OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        to: formattedMobile,
      };

      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else if (fromNumber) {
        messageOptions.from = fromNumber;
      }

      const message = await client.messages.create(messageOptions);

      console.log(`✅ SMS OTP sent to ${formattedMobile} - SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send SMS OTP:', error);
      return false;
    }
  }

  async sendPasswordResetOTP(mobile: string, otp: string): Promise<boolean> {
    try {
      const isConfigured = await isTwilioConfigured();
      if (!isConfigured) {
        console.log(`📱 Password Reset OTP for ${mobile}: ${otp} (Twilio not configured)`);
        return false;
      }

      const client = await getTwilioClient();
      const fromNumber = await getTwilioFromPhoneNumber();
      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

      const messageOptions: any = {
        body: `Your FintekPro password reset OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        to: formattedMobile,
      };

      if (this.messagingServiceSid) {
        messageOptions.messagingServiceSid = this.messagingServiceSid;
      } else if (fromNumber) {
        messageOptions.from = fromNumber;
      }

      const message = await client.messages.create(messageOptions);

      console.log(`✅ Password reset SMS sent to ${formattedMobile} - SID: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send password reset SMS:', error);
      return false;
    }
  }

  async isAvailable(): Promise<boolean> {
    return await isTwilioConfigured();
  }
}

export const smsService = new SMSService();
