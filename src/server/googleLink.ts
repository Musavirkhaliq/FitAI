import { db } from "@/lib/db";

export interface GoogleAccountInfo {
  type: string;
  provider: string;
  providerAccountId: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: unknown;
}

/**
 * Find or create the user for a verified Google identity and link the Google account to it. Returns the user id.
 *
 * Pre-registration hijack guard: if an account with this email already exists but its email was never verified, somebody
 * may have registered it with a password they chose (hoping the real owner signs in with Google later). Google now proves
 * ownership, so we discard that password and any pending verification links before marking the email verified.
 */
export async function linkGoogleAccount(
  profile: { email: string; name?: string | null; image?: string | null },
  account: GoogleAccountInfo,
): Promise<string> {
  const email = profile.email.toLowerCase().trim();
  let user = await db.user.findUnique({ where: { email }, include: { accounts: true } });

  if (!user) {
    user = await db.user.create({
      data: { email, name: profile.name || null, image: profile.image || null, emailVerified: new Date(), profile: { create: { timezone: "UTC" } } },
      include: { accounts: true },
    });
  } else if (!user.emailVerified) {
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { emailVerified: new Date(), image: user.image || profile.image || null, passwordHash: null } }),
      db.verificationToken.deleteMany({ where: { identifier: email } }),
    ]);
  }

  const linked = user.accounts.some((a) => a.provider === account.provider && a.providerAccountId === account.providerAccountId);
  if (!linked) {
    await db.account.create({
      data: {
        userId: user.id,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        access_token: account.access_token ?? null,
        refresh_token: account.refresh_token ?? null,
        expires_at: account.expires_at ?? null,
        token_type: account.token_type ?? null,
        scope: account.scope ?? null,
        id_token: account.id_token ?? null,
        session_state: typeof account.session_state === "string" ? account.session_state : null,
      },
    });
  }
  return user.id;
}
