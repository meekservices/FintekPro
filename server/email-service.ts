import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string = 'support@fintekpro.com';

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT || '587');
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
      console.warn('⚠️ Email service not configured. Missing EMAIL_HOST, EMAIL_USER, or EMAIL_PASS');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      console.log('✅ Email service initialized with SMTP configuration');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.log('📧 [SIMULATED] Email to:', options.to, '| Subject:', options.subject);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"FintekPro" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async sendPasswordResetOTP(email: string, otp: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
          .otp-box { background-color: white; border: 2px dashed #1e40af; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          .warning { color: #dc2626; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FintekPro Password Reset</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Use the OTP below to complete the process:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #6b7280;">Your OTP Code:</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p>This OTP is valid for <strong>10 minutes</strong>.</p>
            
            <p class="warning">
              <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email or contact our support team immediately.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} FintekPro. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
FintekPro Password Reset

We received a request to reset your password.

Your OTP Code: ${otp}

This OTP is valid for 10 minutes.

If you did not request a password reset, please ignore this email or contact our support team.

© ${new Date().getFullYear()} FintekPro. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'FintekPro - Password Reset OTP',
      html,
      text,
    });
  }

  async sendLoginOTP(email: string, otp: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
          .otp-box { background-color: white; border: 2px dashed #1e40af; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          .warning { color: #dc2626; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FintekPro Login Verification</h1>
          </div>
          <div class="content">
            <h2>Verify Your Login</h2>
            <p>Someone is trying to log in to your FintekPro account. Use the OTP below to complete the login:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #6b7280;">Your Login OTP:</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p>This OTP is valid for <strong>5 minutes</strong>.</p>
            
            <p class="warning">
              <strong>Security Notice:</strong> Do not share this OTP with anyone. If you did not attempt to log in, please contact our support team immediately.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} FintekPro. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
FintekPro Login Verification

Someone is trying to log in to your FintekPro account.

Your Login OTP: ${otp}

This OTP is valid for 5 minutes.

Security Notice: Do not share this OTP with anyone. If you did not attempt to log in, please contact our support team.

© ${new Date().getFullYear()} FintekPro. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'FintekPro - Login Verification OTP',
      html,
      text,
    });
  }

  async sendRegistrationOTP(email: string, otp: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
          .otp-box { background-color: white; border: 2px dashed #1e40af; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
          .welcome { color: #059669; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FintekPro!</h1>
          </div>
          <div class="content">
            <p class="welcome">Thank you for choosing FintekPro for your investment journey.</p>
            <h2>Verify Your Email</h2>
            <p>To complete your registration, please enter the verification code below:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #6b7280;">Your Verification Code:</p>
              <div class="otp-code">${otp}</div>
            </div>
            
            <p>This code is valid for <strong>5 minutes</strong>.</p>
            
            <p>
              <strong>Note:</strong> If you did not create an account with FintekPro, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} FintekPro. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to FintekPro!

Thank you for choosing FintekPro for your investment journey.

To complete your registration, please enter the verification code below:

Your Verification Code: ${otp}

This code is valid for 5 minutes.

Note: If you did not create an account with FintekPro, please ignore this email.

© ${new Date().getFullYear()} FintekPro. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: 'FintekPro - Email Verification',
      html,
      text,
    });
  }

  async sendNotificationEmail(to: string, subject: string, message: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>FintekPro</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <div>${message}</div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} FintekPro. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject: `FintekPro - ${subject}`,
      html,
      text: message,
    });
  }
}

export const emailService = new EmailService();
