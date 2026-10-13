import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  verificationLink?: string;
}

/**
 * Sends an email using:
 * 1. Supabase Auth Admin API (if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set)
 * 2. Standard SMTP (if SMTP_HOST, SMTP_USER, SMTP_PASS are set)
 * 3. Development / simulation console logging
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  verificationLink,
}: SendEmailParams): Promise<{ sent: boolean; provider: "supabase" | "smtp" | "simulated"; simulated?: boolean }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Try Supabase Auth Admin API if credentials exist
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          email: to,
          data: { redirectTo: verificationLink },
        }),
      });

      if (res.ok) {
        console.log(`[email:supabase] Successfully dispatched email via Supabase to ${to}`);
        return { sent: true, provider: "supabase" };
      }

      const errBody = await res.json().catch(() => ({}));
      console.warn(`[email:supabase] Notice (${res.status}):`, (errBody as { msg?: string }).msg || res.statusText);
      // If Supabase free tier rate limit is reached or fails, continue to SMTP or dev simulation
    } catch (err) {
      console.warn("[email:supabase] Network error connecting to Supabase Auth:", err);
    }
  }

  // 2. Try SMTP
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || "SukoonFit <noreply@example.com>";

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({ from, to, subject, text, html });
      return { sent: true, provider: "smtp" };
    } catch (err) {
      console.error("[email] Failed to send email via SMTP:", err);
      if (process.env.NODE_ENV !== "production") {
        console.log(`[email:fallback-simulated] To: ${to}\nSubject: ${subject}\nText: ${text}`);
        return { sent: true, provider: "simulated", simulated: true };
      }
      throw err;
    }
  }

  // 3. Fallback to console simulation
  console.log(`\n================== [EMAIL SIMULATION] ==================`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body (Plain): \n${text}`);
  console.log(`========================================================\n`);

  return { sent: true, provider: "simulated", simulated: true };
}
