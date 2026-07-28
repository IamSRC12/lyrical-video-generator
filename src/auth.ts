import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || "dummy-client-id",
      clientSecret: process.env.AUTH_GITHUB_SECRET || "dummy-client-secret"
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/signin"
  },
  callbacks: {
    authorized({ auth }) {
      // In production or demo mode, allow session access
      return !!auth || process.env.NODE_ENV !== "production";
    }
  }
});
