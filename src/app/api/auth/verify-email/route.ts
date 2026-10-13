import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, json, rateLimit, route } from "@/server/api";
import { sendVerificationToken, verifyTokenAndEmail } from "@/server/verification";

const verifySchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email().optional(),
});

const resendSchema = z.object({
  email: z.string().email().max(254),
});

export const POST = route(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const body = await req.json();

  // If action is resend:
  if (body.action === "resend") {
    rateLimit(`resend-email:${ip}`, 5, 15 * 60_000);
    const { email } = resendSchema.parse(body);
    const normEmail = email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email: normEmail },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      return json({ message: "If an account with that email exists, a verification link has been sent." });
    }

    if (user.emailVerified) {
      return json({ message: "Your email is already verified. You can sign in.", alreadyVerified: true });
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = host ? `${proto}://${host}` : undefined;

    const res = await sendVerificationToken(normEmail, baseUrl);
    return json({
      message: "A verification link has been sent to your email address.",
      simulated: res.simulated,
      token: res.token,
    });
  }

  // Verification request
  rateLimit(`verify-email:${ip}`, 20, 15 * 60_000);
  const { token, email } = verifySchema.parse(body);

  const result = await verifyTokenAndEmail(token, email);
  if (!result.success) {
    throw new HttpError(400, result.error || "Verification failed");
  }

  return json({ success: true, message: "Your email has been successfully verified! You can now sign in." });
});
