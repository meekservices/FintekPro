import nodemailer from "nodemailer";

// SMTP connection settings
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

console.log(`[EmailService] 📧 Initializing SMTP transporter with host: ${SMTP_HOST}, port: ${SMTP_PORT}`);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const info = await transporter.sendMail({
      from: '"FintekPro" <no-reply@fintekpro.com>',
      to,
      subject,
      html,
    });
    console.log("[EmailService] Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("[EmailService] Error sending email:", error);
    return false;
  }
};
