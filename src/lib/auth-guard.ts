import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireAuth() {
  const session = await auth();

  // If Auth is configured and running, require user session in production
  if (!session && process.env.NODE_ENV === "production" && process.env.AUTH_GITHUB_ID) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
    };
  }

  return {
    session: session ?? { user: { id: "dev-user", name: "Developer" } },
    response: null
  };
}

export async function requireUser() {
  const res = await requireAuth();
  if (res.response) {
    throw res.response;
  }
  return res.session;
}
