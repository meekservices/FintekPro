import twilio from 'twilio';

interface VoiceCallResult {
  success: boolean;
  callSid?: string;
  status?: string;
  error?: string;
}

interface VoiceOTPResult {
  success: boolean;
  callSid?: string;
  error?: string;
}

class TwilioVoiceService {
  private client: any;
  private fromNumber: string = '';
  private isConfigured: boolean;
  private baseUrl: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    this.baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';

    if (accountSid && authToken && phoneNumber) {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      this.isConfigured = true;
      console.log('✅ Twilio Voice service initialized');
    } else {
      this.isConfigured = false;
      console.log('⚠️ Twilio Voice service not configured - missing credentials');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  private formatPhoneNumber(mobile: string): string {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  }

  private generateOTPTwiML(otp: string): string {
    const digits = otp.split('').join(', ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    Hello! This is FintekPro verification service.
    Your one time password is: ${digits}.
    I repeat, your OTP is: ${digits}.
    This code is valid for 5 minutes.
    Thank you for using FintekPro.
  </Say>
</Response>`;
  }

  async sendOTPCall(to: string, otp: string): Promise<VoiceOTPResult> {
    if (!this.isConfigured) {
      console.log(`📞 Voice OTP to ${to.substring(0, 6)}****: ${otp} (not configured)`);
      return { success: false, error: 'Voice service not configured' };
    }

    try {
      const toNumber = this.formatPhoneNumber(to);
      const twiml = this.generateOTPTwiML(otp);

      const call = await this.client.calls.create({
        twiml,
        to: toNumber,
        from: this.fromNumber,
        timeout: 30,
        machineDetection: 'Enable',
        machineDetectionTimeout: 5
      });

      console.log(`✅ Voice OTP call initiated to ${toNumber.substring(0, 8)}*** - SID: ${call.sid}`);
      
      return { success: true, callSid: call.sid };
    } catch (error: any) {
      console.error('❌ Failed to send Voice OTP:', error.message);
      return { success: false, error: error.message };
    }
  }

  async makeCall(to: string, twiml: string): Promise<VoiceCallResult> {
    if (!this.isConfigured) {
      console.log(`📞 Voice call to ${to.substring(0, 6)}**** (not configured)`);
      return { success: false, error: 'Voice service not configured' };
    }

    try {
      const toNumber = this.formatPhoneNumber(to);

      const call = await this.client.calls.create({
        twiml,
        to: toNumber,
        from: this.fromNumber
      });

      console.log(`✅ Voice call initiated to ${toNumber.substring(0, 8)}*** - SID: ${call.sid}`);
      
      return { 
        success: true, 
        callSid: call.sid,
        status: call.status
      };
    } catch (error: any) {
      console.error('❌ Failed to make voice call:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetOTP(to: string, otp: string): Promise<VoiceOTPResult> {
    if (!this.isConfigured) {
      console.log(`📞 Password reset voice OTP to ${to.substring(0, 6)}****: ${otp} (not configured)`);
      return { success: false, error: 'Voice service not configured' };
    }

    try {
      const toNumber = this.formatPhoneNumber(to);
      const digits = otp.split('').join(', ');
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    Hello! This is FintekPro security service.
    Your password reset code is: ${digits}.
    I repeat, your code is: ${digits}.
    This code is valid for 5 minutes.
    If you did not request this, please contact support immediately.
  </Say>
</Response>`;

      const call = await this.client.calls.create({
        twiml,
        to: toNumber,
        from: this.fromNumber,
        timeout: 30
      });

      console.log(`✅ Password reset voice call to ${toNumber.substring(0, 8)}*** - SID: ${call.sid}`);
      
      return { success: true, callSid: call.sid };
    } catch (error: any) {
      console.error('❌ Failed to send password reset voice OTP:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendTransactionAlert(to: string, details: {
    type: string;
    amount: number;
    symbol?: string;
    orderId: string;
  }): Promise<VoiceCallResult> {
    if (!this.isConfigured) {
      return { success: false, error: 'Voice service not configured' };
    }

    try {
      const toNumber = this.formatPhoneNumber(to);
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">
    FintekPro transaction alert.
    A ${details.type} transaction of ${details.amount} rupees 
    ${details.symbol ? `for ${details.symbol}` : ''} 
    has been processed.
    Order ID: ${details.orderId}.
    If you did not authorize this, please contact support immediately.
  </Say>
</Response>`;

      const call = await this.client.calls.create({
        twiml,
        to: toNumber,
        from: this.fromNumber,
        timeout: 30
      });

      console.log(`✅ Transaction alert call to ${toNumber.substring(0, 8)}*** - SID: ${call.sid}`);
      
      return { success: true, callSid: call.sid, status: call.status };
    } catch (error: any) {
      console.error('❌ Failed to send transaction alert:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getCallStatus(callSid: string): Promise<{ status?: string; duration?: number; error?: string }> {
    if (!this.isConfigured) {
      return { error: 'Voice service not configured' };
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      return {
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : undefined
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }
}

export const twilioVoiceService = new TwilioVoiceService();
