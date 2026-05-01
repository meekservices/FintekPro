import { getTwilioClient, getTwilioFromPhoneNumber, isTwilioConfigured } from './twilio-client';

class SMSService {
  private primaryPhone: string = '';
  private messagingServiceSid: string = '';

  constructor() {
    this.primaryPhone = process.env.TWILIO_PRIMARY_PHONE || process.env.TWILIO_PHONE_NUMBER || '';
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';
    console.log('📱 SMS service initialized');
    if (this.primaryPhone) {
      console.log(`   Primary phone: ${this.primaryPhone}`);
    }
    if (this.messagingServiceSid) {
      console.log(`   Backup Messaging Service SID: ${this.messagingServiceSid.substring(0, 10)}...`);
    }
  }

  private async sendSMSWithFallback(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
    const client = await getTwilioClient();
    
    // Try primary phone number first
    if (this.primaryPhone) {
      try {
        console.log(`📱 Trying primary phone ${this.primaryPhone} for ${to}...`);
        const message = await client.messages.create({
          body,
          from: this.primaryPhone,
          to,
        });
        console.log(`✅ SMS sent via primary phone - SID: ${message.sid}`);
        return { success: true, sid: message.sid };
      } catch (primaryError: any) {
        console.log(`⚠️ Primary phone failed: ${primaryError.message}, trying backup...`);
      }
    }
    
    // Fallback to Messaging Service SID
    if (this.messagingServiceSid) {
      try {
        console.log(`📱 Trying Messaging Service SID for ${to}...`);
        const message = await client.messages.create({
          body,
          messagingServiceSid: this.messagingServiceSid,
          to,
        });
        console.log(`✅ SMS sent via Messaging Service - SID: ${message.sid}`);
        return { success: true, sid: message.sid };
      } catch (backupError: any) {
        console.log(`⚠️ Messaging Service failed: ${backupError.message}, trying connector phone...`);
      }
    }
    
    // Final fallback to Twilio connector phone number
    const fromNumber = await getTwilioFromPhoneNumber();
    if (fromNumber) {
      try {
        console.log(`📱 Trying connector phone ${fromNumber} for ${to}...`);
        const message = await client.messages.create({
          body,
          from: fromNumber,
          to,
        });
        console.log(`✅ SMS sent via connector phone - SID: ${message.sid}`);
        return { success: true, sid: message.sid };
      } catch (fallbackError: any) {
        console.error(`❌ All SMS methods failed: ${fallbackError.message}`);
      }
    }
    
    return { success: false };
  }

  async sendOTP(mobile: string, otp: string): Promise<boolean> {
    try {
      const isConfigured = await isTwilioConfigured();
      if (!isConfigured) {
        console.log(`📱 SMS OTP for ${mobile}: ${otp} (Twilio not configured)`);
        return false;
      }

      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;
      const body = `Your FintekPro login OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

      const result = await this.sendSMSWithFallback(formattedMobile, body);
      
      if (result.success) {
        console.log(`✅ SMS OTP sent to ${formattedMobile} - SID: ${result.sid}`);
      }
      return result.success;
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

      const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;
      const body = `Your FintekPro password reset OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`;

      const result = await this.sendSMSWithFallback(formattedMobile, body);
      
      if (result.success) {
        console.log(`✅ Password reset SMS sent to ${formattedMobile} - SID: ${result.sid}`);
      }
      return result.success;
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
