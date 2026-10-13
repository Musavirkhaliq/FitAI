import type { NextAuthConfig } from "next-auth";

/** Edge-safe half of the Auth.js config (used by middleware): no Prisma, no bcrypt. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/verify-email" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/register") ||
        pathname === "/manifest.webmanifest" ||
        pathname === "/sw.js" ||
        pathname.startsWith("/icons");
      if (isPublic) return true;
      if (auth?.user) return true;
      // API callers get a machine-readable 401 instead of a redirect to an HTML login page.
      if (pathname.startsWith("/api/")) return Response.json({ error: "Please sign in." }, { status: 401 });
      return false;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
