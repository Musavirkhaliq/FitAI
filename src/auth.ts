import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import { linkGoogleAccount } from "./server/googleLink";

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
        // All linking rules (including the pre-registration hijack guard) live in one tested function.
        user.id = await linkGoogleAccount({ email: user.email, name: user.name, image: user.image }, account);
        return true;
      }

      return true;
    },
  },
});
