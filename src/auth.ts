import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const {handlers, auth, signIn, signOut} = NextAuth({
  providers: [GitHub],
  pages: {
    signIn: "/"
  },
  session: {
    strategy: "jwt"
  },
  callbacks: {
    authorized: async ({auth: session}) => Boolean(session)
  }
});
