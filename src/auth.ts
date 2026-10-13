import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";

let dummy: string | undefined;
const dummyHash = () => (dummy ??= bcrypt.hashSync("not-a-real-password", 10));

const credsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        // If user has no passwordHash (e.g. signed up exclusively with Google OAuth), reject credentials
        const hash = user?.passwordHash ?? dummyHash();
        const ok = user?.passwordHash ? await bcrypt.compare(parsed.data.password, hash) : false;
        if (!user || !ok) return null;

        if (!user.emailVerified) {
          throw new Error("UNVERIFIED_EMAIL");
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const email = user.email.toLowerCase().trim();

        let existingUser = await db.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        if (!existingUser) {
          existingUser = await db.user.create({
            data: {
              email,
              name: user.name || null,
              image: user.image || null,
              emailVerified: new Date(),
              profile: { create: { timezone: "UTC" } },
            },
            include: { accounts: true },
          });
        } else {
          // If user exists but email was not verified yet, Google verifies it
          if (!existingUser.emailVerified) {
            await db.user.update({
              where: { id: existingUser.id },
              data: { emailVerified: new Date(), image: existingUser.image || user.image },
            });
          }
        }

        // Link the Google Account if not linked already
        const hasAccount = existingUser.accounts.some(
          (a) => a.provider === account.provider && a.providerAccountId === account.providerAccountId
        );

        if (!hasAccount) {
          await db.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: (account.session_state as string) ?? null,
            },
          });
        }

        // Ensure user id maps to the db user id
        user.id = existingUser.id;
        return true;
      }

      return true;
    },
  },
});
