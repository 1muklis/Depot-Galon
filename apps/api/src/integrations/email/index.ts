import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendEmail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${html}`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html });
  } catch (e) {
    // email tidak boleh menggagalkan alur utama
    console.error('[email] gagal mengirim', e);
  }
}

export const sendPasswordResetEmail = (to: string, name: string, token: string) => {
  const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  return sendEmail(
    to,
    'Reset password',
    `<p>Halo ${name},</p><p>Klik tautan berikut untuk mengatur ulang password (berlaku 1 jam):</p><p><a href="${link}">${link}</a></p>`,
  );
};
