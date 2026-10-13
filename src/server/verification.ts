import crypto from "crypto";
import { db } from "@/lib/db";
import { sendEmail } from "./email";

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Creates or replaces an email verification token for the specified email and dispatches the email.
 */
export async function sendVerificationToken(email: string, baseUrl?: string): Promise<{ simulated?: boolean; token?: string }> {
  const normEmail = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Delete any pre-existing tokens for this email to avoid stale entries
  await db.verificationToken.deleteMany({
    where: { identifier: normEmail },
  });

  await db.verificationToken.create({
    data: {
      identifier: normEmail,
      token,
      expiresAt,
    },
  });

  const appUrl = (baseUrl || process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const verifyLink = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(normEmail)}`;

  const subject = "Verify your email for SukoonFit";
  const text = `Welcome to SukoonFit!\n\nPlease verify your email address by visiting the following link:\n${verifyLink}\n\nThis link will expire in 24 hours.\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0;">Verify your email address</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.5;">Welcome to SukoonFit! Click the button below to verify your email and activate your account.</p>
      <div style="margin: 28px 0;">
        <a href="${verifyLink}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.4;">Or copy and paste this link into your browser:<br/><a href="${verifyLink}" style="color: #0284c7; word-break: break-all;">${verifyLink}</a></p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
    </div>
  `;

  const res = await sendEmail({ to: normEmail, subject, text, html, verificationLink: verifyLink });
  return { simulated: res.simulated, token: res.simulated ? token : undefined };
}

/**
 * Validates the verification token, verifies user email in db, and cleans up token.
 */
export async function verifyTokenAndEmail(token: string, email?: string): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: "Verification token is missing." };

  const record = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return { success: false, error: "Invalid or expired verification link." };
  }

  if (record.expiresAt < new Date()) {
    await db.verificationToken.delete({ where: { id: record.id } }).catch(() => undefined);
    return { success: false, error: "This verification link has expired. Please request a new one." };
  }

  if (email && record.identifier.toLowerCase() !== email.toLowerCase().trim()) {
    return { success: false, error: "Verification email does not match." };
  }

  // Update user's emailVerified timestamp
  await db.user.updateMany({
    where: { email: record.identifier.toLowerCase() },
    data: { emailVerified: new Date() },
  });

  // Delete the used token
  await db.verificationToken.delete({ where: { id: record.id } });

  return { success: true };
}
