import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, json, rateLimit, route } from "@/server/api";
import { sendVerificationToken } from "@/server/verification";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  name: z.string().trim().max(60).optional(),
  timezone: z.string().max(64).optional(),
});

export const POST = route(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  rateLimit(`register:${ip}`, 10, 60 * 60_000);
  const body = schema.parse(await req.json());
  const email = body.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "An account with that email already exists.");
  const passwordHash = await bcrypt.hash(body.password, 11);
  try {
    const user = await db.user.create({
      data: {
        email,
        name: body.name || null,
        passwordHash,
        emailVerified: null,
        profile: { create: { timezone: validTz(body.timezone) } },
      },
      select: { id: true, email: true },
    });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = host ? `${proto}://${host}` : undefined;

    const emailRes = await sendVerificationToken(email, baseUrl);

    return json({
      id: user.id,
      email: user.email,
      requiresVerification: true,
      simulated: emailRes.simulated,
      token: emailRes.token,
    }, { status: 201 });
  } catch (err) {
    // Two submits can both pass the check above; the unique index is the real guard.
    if ((err as { code?: string }).code === "P2002") throw new HttpError(409, "An account with that email already exists.");
    throw err;
  }
});

function validTz(tz?: string): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
