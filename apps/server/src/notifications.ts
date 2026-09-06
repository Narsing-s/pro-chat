import nodemailer from 'nodemailer';

const smtpUrl = process.env.SMTP_URL?.trim();
const smtpService = process.env.SMTP_SERVICE?.trim();
const smtpUser = process.env.SMTP_USER?.trim();
const smtpPass = process.env.SMTP_PASS?.trim();
const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;

const mailer = smtpUrl
  ? nodemailer.createTransport(smtpUrl)
  : smtpService && smtpUser && smtpPass
    ? nodemailer.createTransport({ service: smtpService, auth: { user: smtpUser, pass: smtpPass } })
    : smtpUser && smtpPass && process.env.SMTP_HOST
      ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false', auth: { user: smtpUser, pass: smtpPass } })
      : null;

export const emailConfigured = Boolean(mailer && smtpFrom);

export async function sendVerificationEmail(to: string, code: string, purpose: string) {
  if (!mailer || !smtpFrom) return false;
  const title = purpose === 'password-reset' ? 'Reset your Pro Chat password' : purpose === 'change-email' ? 'Confirm your new Pro Chat email' : 'Verify your Pro Chat email';
  await mailer.sendMail({
    from: smtpFrom,
    to,
    subject: title,
    text: `Your Pro Chat verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`,
    html: `<p>Your Pro Chat verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, ignore this message.</p>`
  });
  return true;
}

const twilioAccount = process.env.TWILIO_ACCOUNT_SID?.trim();
const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
const twilioService = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

export const smsConfigured = Boolean(twilioAccount && twilioToken && twilioService);

export async function sendSmsVerification(to: string) {
  if (!smsConfigured) return false;
  const auth = Buffer.from(`${twilioAccount}:${twilioToken}`).toString('base64');
  const body = new URLSearchParams({ To: to, Channel: 'sms' });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${twilioService}/Verifications`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw new Error(`SMS verification delivery failed (${response.status})`);
  return true;
}

export async function checkSmsVerification(to: string, code: string) {
  if (!smsConfigured) return false;
  const auth = Buffer.from(`${twilioAccount}:${twilioToken}`).toString('base64');
  const body = new URLSearchParams({ To: to, Code: code });
  const response = await fetch(`https://verify.twilio.com/v2/Services/${twilioService}/VerificationCheck`, { method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) return false;
  const data = await response.json() as { status?: string };
  return data.status === 'approved';
}
